# -------- Root endpoint --------

# Place this after app initialization

# ...existing code...


# server.py
import os
import io
import json
import base64
import time
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from PIL import Image, ImageDraw
import numpy as np

# Optional OpenCV import for face processing
try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    print("Warning: OpenCV not available. Face verification features disabled.")
    OPENCV_AVAILABLE = False

# Optional scikit-image import for structural similarity
try:
    from skimage.metrics import structural_similarity as ssim
    SKIMAGE_AVAILABLE = True
except ImportError:
    print("Warning: scikit-image not available. Using basic image comparison.")
    SKIMAGE_AVAILABLE = False

import torch
import torch.nn as nn
from torchvision import models, transforms
from skimage import filters, transform as sk_transform

BASE_DIR = os.path.dirname(__file__)

# -------- Config --------
EMBEDDING_DIM = 128
IMAGE_SIZE = 224
MODEL_WEIGHTS = os.path.join(BASE_DIR, "signature_embedding.pth")  # saved embedding model weights (embedding network)
EMBED_DB = os.path.join(BASE_DIR, "embeddings_db.json")
SAMPLES_DIR = os.path.join(BASE_DIR, "registered_images")
VERIFY_THRESHOLD = 0.85  # cosine similarity threshold (0..1). More strict for security (was 0.75)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
NEXTJS_BUILD_DIR = os.path.join(BASE_DIR, ".next")
NEXTJS_OUT_DIR = os.path.join(BASE_DIR, "out")

os.makedirs(SAMPLES_DIR, exist_ok=True)

# -------- Lifespan/startup --------
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.MODEL = load_model(MODEL_WEIGHTS, device=DEVICE)
    # Load and normalize database structure to the new schema
    raw_db = load_embeddings_db()
    normalized_db, changed = normalize_full_db(raw_db)
    if changed:
        save_embeddings_db(normalized_db)
    app.state.EMB_DB_DATA = normalized_db
    print("Server ready. Device:", DEVICE)
    yield
    # optional cleanup here

app = FastAPI(title="Signature Verification Backend", lifespan=lifespan)

# Mount Next.js static files
if os.path.isdir(NEXTJS_OUT_DIR):
    try:
        app.mount("/static", StaticFiles(directory=os.path.join(NEXTJS_OUT_DIR, "_next/static")), name="static")
        print(f"Mounted Next.js static files from {NEXTJS_OUT_DIR}")
    except Exception as e:
        print("Could not mount Next.js static files:", e)

# Mount legacy frontend if exists
if os.path.isdir(FRONTEND_DIR):
    try:
        app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    except Exception as e:
        print("Could not mount legacy frontend:", e)


# -------- Utilities --------
def save_embeddings_db(db: Dict[str, Any]):
    with open(EMBED_DB, "w") as f:
        json.dump(db, f, indent=2)


def load_embeddings_db() -> Dict[str, Any]:
    if not os.path.exists(EMBED_DB):
        return {}
    with open(EMBED_DB, "r") as f:
        return json.load(f)


def ensure_user_db_entry(db: Dict[str, Any], user_id: str):
    """Ensure the user entry exists with the new nested structure.
    Structure:
    {
      user_id: {
        "profile": {name, age, gender, email},
        "face_embedding": [128 floats] | None,
        "signatures": {"embeddings": [], "mean_embedding": None, "samples": []}
      }
    }
    """
    if user_id not in db:
        db[user_id] = {
            "profile": {},
            "face_embedding": None,
            "signatures": {"embeddings": [], "mean_embedding": None, "samples": []},
        }
    else:
        # Migrate legacy flat signature structure if present
        entry = db[user_id]
        sig = entry.get("signatures")
        if sig is None:
            embeddings = entry.get("embeddings", [])
            mean_embedding = entry.get("mean_embedding")
            samples = entry.get("samples", [])
            entry["signatures"] = {
                "embeddings": embeddings if isinstance(embeddings, list) else [],
                "mean_embedding": mean_embedding,
                "samples": samples if isinstance(samples, list) else [],
            }
            # Clean legacy keys
            for k in ("embeddings", "mean_embedding", "samples"):
                if k in entry:
                    try:
                        del entry[k]
                    except Exception:
                        pass
        if "profile" not in entry:
            entry["profile"] = {}
        if "face_embedding" not in entry:
            entry["face_embedding"] = None


def normalize_full_db(db: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    """Normalize entire DB to new schema. Returns (db, changed)."""
    changed = False
    for user_id in list(db.keys()):
        before = json.dumps(db[user_id], sort_keys=True, default=str)
        ensure_user_db_entry(db, user_id)
        after = json.dumps(db[user_id], sort_keys=True, default=str)
        if before != after:
            changed = True
    return db, changed


# ---------- Model (ResNet50 -> EMBEDDING_DIM-d embedding) ----------
class EmbeddingNet(nn.Module):
    def __init__(self, out_dim=EMBEDDING_DIM):
        super().__init__()
        from torchvision.models import ResNet50_Weights
        base = models.resnet50(weights=ResNet50_Weights.DEFAULT)
        in_features = base.fc.in_features
        base.fc = nn.Linear(in_features, out_dim)
        self.base = base

    def forward(self, x):
        return self.base(x)


def load_model(weights_path: Optional[str] = None, device=DEVICE):
    model = EmbeddingNet().to(device)
    model.eval()
    if weights_path and os.path.exists(weights_path):
        print(f"Loading weights from {weights_path}")
        state = torch.load(weights_path, map_location=device)
        try:
            model.load_state_dict(state)
        except Exception:
            # try partial load
            model_state = model.state_dict()
            for k, v in state.items():
                if k in model_state and v.shape == model_state[k].shape:
                    model_state[k] = v
            model.load_state_dict(model_state)
        print("Weights loaded.")
    else:
        print("WARNING: No trained weights found! Signature verification will be unreliable.")
        print("For production use, train a signature verification model or use basic visual comparison.")
    return model


# -------- Preprocessing pipeline ----------
def render_strokes_to_image(strokes: List[List[Dict[str, float]]], size=(IMAGE_SIZE, IMAGE_SIZE), bg=255):
    if not strokes:
        return None
    pts = []
    for stroke in strokes:
        for p in stroke:
            try:
                pts.append((p["x"], p["y"]))
            except KeyError as e:
                print(f"Malformed stroke point: {p}, missing key: {e}")
                continue
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    if len(xs) == 0:
        return None
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    w = maxx - minx if maxx > minx else 1.0
    h = maxy - miny if maxy > miny else 1.0
    scale = 0.9 * min(size[0] / w, size[1] / h)
    img = Image.new("L", size, color=bg)
    draw = ImageDraw.Draw(img)
    for stroke in strokes:
        norm_pts = []
        for p in stroke:
            try:
                norm_pts.append(((p["x"] - minx) * scale + size[0] * 0.05, (p["y"] - miny) * scale + size[1] * 0.05))
            except KeyError as e:
                print(f"Malformed stroke point in drawing: {p}, missing key: {e}")
                continue
        if len(norm_pts) >= 2:
            draw.line(norm_pts, fill=0, width=3)
        elif len(norm_pts) == 1:
            x, y = norm_pts[0]
            draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=0)
    return img


def decode_base64_image(data_url: str) -> Image.Image:
    if "," in data_url:
        header, b64 = data_url.split(",", 1)
    else:
        b64 = data_url
    data = base64.b64decode(b64)
    img = Image.open(io.BytesIO(data)).convert("L")
    return img


def decode_base64_image_rgb(data_url: str) -> Image.Image:
    """Decode base64 data URL to RGB image (for face processing)."""
    if "," in data_url:
        _, b64 = data_url.split(",", 1)
    else:
        b64 = data_url
    data = base64.b64decode(b64)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return img


def preprocess_image(img: Image.Image, size=IMAGE_SIZE) -> Image.Image:
    """Normalize, crop around dark strokes, keep white background.

    Previous version inverted foreground/background and then cropped using the
    background mask, producing mostly black images. This keeps original polarity.
    """
    arr = np.array(img.convert("L"))
    if arr.dtype != np.uint8:
        arr = (255 * (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)).astype(np.uint8)

    # Otsu threshold – foreground are darker (< thresh)
    try:
        thresh = filters.threshold_otsu(arr)
    except Exception:
        thresh = 128
    fg_mask = arr < thresh  # True where strokes (dark)
    coords = np.argwhere(fg_mask)
    if coords.size > 0:
        y0, x0 = coords.min(axis=0)
        y1, x1 = coords.max(axis=0)
        cropped = arr[y0:y1 + 1, x0:x1 + 1]
    else:
        cropped = arr

    h, w = cropped.shape
    max_side = max(h, w)
    pad_h = (max_side - h) // 2
    pad_w = (max_side - w) // 2
    # Create white square canvas then paste cropped (top-left offset)
    canvas = np.full((max_side, max_side), 255, dtype=np.uint8)
    canvas[pad_h:pad_h + h, pad_w:pad_w + w] = cropped

    resized = sk_transform.resize(canvas, (size, size), preserve_range=True, anti_aliasing=True).astype(np.uint8)
    return Image.fromarray(resized, mode="L")


to_tensor_and_normalize = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.Lambda(lambda img: img.convert("RGB")),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def image_to_embedding(model: nn.Module, pil_img: Image.Image, device=DEVICE) -> np.ndarray:
    tensor = to_tensor_and_normalize(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        emb = model(tensor)
        emb = emb.cpu().numpy().reshape(-1)
    norm = np.linalg.norm(emb) + 1e-10
    emb = emb / norm
    return emb.astype(float)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a)
    b = np.asarray(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


# -------- FastAPI / Request models --------
class SampleModel(BaseModel):
    type: str  # 'upload' or 'pad'
    image: Optional[str] = None  # base64 dataurl
    strokes: Optional[List[List[Dict[str, float]]]] = None
    created: Optional[str] = None


class RegisterPayload(BaseModel):
    user_id: str
    samples: List[SampleModel]


# -------- User/Face Models --------
class UserProfile(BaseModel):
    user_id: str
    name: str
    age: int
    gender: str
    email: EmailStr


class FaceRegisterPayload(BaseModel):
    user_id: str
    image: str  # Base64 data URL


class ProfileUpdate(BaseModel):
    user_id: str
    data: Dict[str, Any]


# Allow your local frontend to call (adjust origins if serving frontend differently)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:5500", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Endpoints --------
@app.post("/process_signature_registration", summary="Process Signature Registration", response_description="Registration result", response_model=Dict[str, Any])
async def process_signature_registration(payload: RegisterPayload):
    user_id = payload.user_id
    samples = payload.samples
    if not samples:
        raise HTTPException(status_code=400, detail="No samples provided")

    db = app.state.EMB_DB_DATA
    ensure_user_db_entry(db, user_id)
    MODEL = app.state.MODEL

    saved = []
    for i, s in enumerate(samples):
        try:
            if s.strokes:
                pil = render_strokes_to_image(s.strokes, size=(IMAGE_SIZE, IMAGE_SIZE))
            elif s.image:
                pil = decode_base64_image(s.image)
            else:
                continue
            pil = preprocess_image(pil, size=IMAGE_SIZE)
            emb = image_to_embedding(MODEL, pil, device=DEVICE).tolist()

            timestamp = s.created or time.strftime("%Y-%m-%d %H:%M:%S")
            sample_name = f"{user_id}_{int(time.time())}_{i}.png"
            sample_path = os.path.join(SAMPLES_DIR, sample_name)
            pil.convert("L").save(sample_path)

            db[user_id]["signatures"]["embeddings"].append(emb)
            db[user_id]["signatures"]["samples"].append({"path": sample_path, "time": timestamp, "type": s.type})
            saved.append(sample_path)
        except Exception as e:
            print("Failed to process sample:", e)
            continue

    if db[user_id]["signatures"]["embeddings"]:
        arr = np.array(db[user_id]["signatures"]["embeddings"], dtype=float)
        mean_emb = np.mean(arr, axis=0)
        mean_emb = mean_emb / (np.linalg.norm(mean_emb) + 1e-10)
        db[user_id]["signatures"]["mean_embedding"] = mean_emb.tolist()
    save_embeddings_db(db)
    app.state.EMB_DB_DATA = db
    return {"success": True, "saved_samples": saved, "count": len(db[user_id]["signatures"]["embeddings"]) }

@app.post("/verify_signature", summary="Verify Signature", response_description="Verification result", response_model=Dict[str, Any])
async def verify_signature(req: Request):
    """
    Verify a signature for a user. Accepts either base64 image or strokes.
    Example payloads:
    {
        "user_id": "demo_user",
        "image": "data:image/png;base64,..."
    }
    or
    {
        "user_id": "demo_user",
        "strokes": [
            [
                {"x": 10, "y": 20, "t": 1234567890},
                {"x": 15, "y": 25, "t": 1234567891}
            ]
        ]
    }
    """
    body = await req.json()
    user_id = body.get("user_id")
    image_b64 = body.get("image")
    strokes = body.get("strokes")

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")

    db = app.state.EMB_DB_DATA
    if user_id not in db:
        return {"success": False, "error": "No registration found for user"}
    sig = db[user_id].get("signatures", {})
    if (not sig.get("mean_embedding") and not sig.get("embeddings")):
        return {"success": False, "error": "No registration found for user"}

    if strokes:
        pil = render_strokes_to_image(strokes, size=(IMAGE_SIZE, IMAGE_SIZE))
    elif image_b64:
        pil = decode_base64_image(image_b64)
    else:
        raise HTTPException(status_code=400, detail="Missing image or strokes")

    # Validate that the image looks like a signature (has some dark content)
    img_array = np.array(pil.convert("L"))
    dark_pixels = int(np.sum(img_array < 200))  # Count pixels that are darker than light gray
    total_pixels = int(img_array.shape[0] * img_array.shape[1])
    dark_ratio = float(dark_pixels / total_pixels)
    
    print(f"Signature validation - Dark pixels ratio: {dark_ratio:.3f}")  # Debug
    
    if dark_ratio < 0.02:  # Less than 2% dark pixels - likely not a real signature
        print(f"Signature rejected: too few dark pixels ({dark_ratio:.3f})")
        return {"success": False, "error": "Invalid signature - image appears to be empty or too light", "score": 0.0}
    
    pil = preprocess_image(pil, size=IMAGE_SIZE)
    emb = image_to_embedding(app.state.MODEL, pil, device=DEVICE)

    user_mean = np.array(sig.get("mean_embedding")) if sig.get("mean_embedding") else None
    user_embs = np.array(sig.get("embeddings")) if sig.get("embeddings") else None

    best_score = -1.0
    scores = []
    if user_mean is not None:
        score = float(cosine_similarity(emb, user_mean))
        scores.append(score)
        best_score = max(best_score, score)
    if user_embs is not None and user_embs.shape[0] > 0:
        for ue in user_embs:
            s = float(cosine_similarity(emb, np.array(ue)))
            scores.append(s)
            if s > best_score:
                best_score = s

    print(f"Signature verification - User: {user_id}, Best score: {best_score:.3f}, Threshold: {VERIFY_THRESHOLD}")  # Debug
    
    # Since the model is untrained, use visual comparison instead of embeddings
    STRICT_THRESHOLD = 0.95  # Very high threshold for untrained model
    
    if not os.path.exists(MODEL_WEIGHTS):
        print("Using visual comparison due to untrained model")
        
        # Use direct image comparison instead of unreliable embeddings
        if user_embs is None or len(user_embs) == 0:
            print("No registered signatures found")
            match = False
        else:
            # Get stored signature samples for direct comparison
            stored_samples = sig.get("samples", [])
            if not stored_samples:
                print("No stored signature samples for comparison")
                match = False
            else:
                # Compare current signature with stored samples using structural similarity
                max_visual_similarity = 0.0
                current_gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if len(img_array.shape) == 3 else img_array
                
                for i, sample in enumerate(stored_samples):
                    try:
                        # Decode stored sample
                        import base64
                        from io import BytesIO
                        
                        # Check if sample has image data or file path
                        sample_image = sample.get("image", "")
                        sample_path = sample.get("path", "")
                        
                        if sample_image:
                            # Handle base64 image data
                            if sample_image.startswith("data:image"):
                                base64_data = sample_image.split(",")[1]
                            else:
                                base64_data = sample_image
                            
                            try:
                                stored_img_data = base64.b64decode(base64_data)
                                stored_pil = Image.open(BytesIO(stored_img_data)).convert("RGB")
                            except Exception as decode_error:
                                print(f"Sample {i}: Failed to decode base64 data: {decode_error}")
                                continue
                                
                        elif sample_path and os.path.exists(sample_path):
                            # Handle file path
                            try:
                                stored_pil = Image.open(sample_path).convert("RGB")
                                print(f"Sample {i}: Loaded from file path: {sample_path}")
                            except Exception as file_error:
                                print(f"Sample {i}: Failed to load from file path {sample_path}: {file_error}")
                                continue
                        else:
                            print(f"Sample {i}: No valid image data or file path found")
                            continue
                        stored_array = np.array(stored_pil)
                        stored_gray = cv2.cvtColor(stored_array, cv2.COLOR_RGB2GRAY)
                        
                        # Resize to same dimensions for comparison
                        h, w = current_gray.shape
                        stored_resized = cv2.resize(stored_gray, (w, h))
                        
                        # Calculate structural similarity
                        if SKIMAGE_AVAILABLE:
                            similarity = float(ssim(current_gray, stored_resized))  # Convert to Python float
                        else:
                            # Fallback: normalized cross-correlation
                            correlation = cv2.matchTemplate(current_gray, stored_resized, cv2.TM_CCOEFF_NORMED)
                            similarity = float(np.max(correlation))  # Convert to Python float
                        
                        max_visual_similarity = float(max(max_visual_similarity, similarity))
                        
                        print(f"Visual similarity with sample {i}: {similarity:.3f}")
                        
                    except Exception as e:
                        print(f"Error comparing with sample {i}: {e}")
                        continue
                
                # Use more reasonable visual similarity threshold (like face verification)
                VISUAL_THRESHOLD = 0.50  # 50% structural similarity required (balanced like face verification)
                
                print(f"Max visual similarity: {max_visual_similarity:.3f}, threshold: {VISUAL_THRESHOLD}")
                
                # If visual comparison failed completely (no valid samples), fall back to embedding similarity
                if max_visual_similarity == 0.0:
                    print("Visual comparison failed, using embedding similarity as fallback")
                    EMBEDDING_THRESHOLD = 0.60  # More reasonable than 0.85
                    match = bool(best_score >= EMBEDDING_THRESHOLD)  # Convert to Python bool
                    print(f"Using embedding similarity: {best_score:.3f}, threshold: {EMBEDDING_THRESHOLD}")
                else:
                    match = bool(max_visual_similarity >= VISUAL_THRESHOLD)  # Convert to Python bool
                    best_score = float(max_visual_similarity)  # Override with visual similarity score and convert to float
                
                # Additional security checks only if initially matched
                if match:
                    # Check signature complexity (relaxed)
                    current_complexity = float(np.std(current_gray) if len(current_gray.shape) == 2 else np.std(cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)))
                    if current_complexity < 10:  # Too simple/uniform (relaxed from 15)
                        print(f"Signature rejected: too simple (complexity: {current_complexity:.1f})")
                        match = False
                    
                    # Check for minimum ink coverage (relaxed)
                    if dark_ratio < 0.02:  # Less than 2% dark pixels (relaxed from 3%)
                        print(f"Signature rejected: insufficient ink coverage ({dark_ratio:.3f})")
                        match = False
    else:
        match = bool(best_score >= VERIFY_THRESHOLD)
    
    return {
        "success": True, 
        "match": bool(match),  # Convert numpy.bool_ to Python bool
        "score": float(best_score), 
        "threshold": float(STRICT_THRESHOLD if not os.path.exists(MODEL_WEIGHTS) else VERIFY_THRESHOLD),
        "all_scores": [float(s) for s in scores],  # Convert numpy types to Python types
        "dark_ratio": float(dark_ratio),
        "model_trained": bool(os.path.exists(MODEL_WEIGHTS))
    }


@app.get("/user/{user_id}/signatures")
def list_user_signatures(user_id: str):
    db = app.state.EMB_DB_DATA
    if user_id not in db:
        raise HTTPException(status_code=404, detail="user not found")
    sig = db[user_id].get("signatures", {"embeddings": [], "samples": [], "mean_embedding": None})
    return {
        "user_id": user_id,
        "count": len(sig.get("embeddings", [])),
        "samples": sig.get("samples", []),
        "mean_embedding": sig.get("mean_embedding"),
        "face_registered": db[user_id].get("face_embedding") is not None,
        "profile": db[user_id].get("profile", {}),
    }


@app.get("/user/{user_id}/status")
def user_status(user_id: str):
    db = app.state.EMB_DB_DATA
    if user_id not in db:
        return {
            "exists": False,
            "user_id": user_id,
            "profile": {},
            "face_registered": False,
            "signature_count": 0,
        }
    entry = db[user_id]
    sig = entry.get("signatures", {})
    return {
        "exists": True,
        "user_id": user_id,
        "profile": entry.get("profile", {}),
        "face_registered": entry.get("face_embedding") is not None,
        "signature_count": len(sig.get("embeddings", [])),
    }


@app.get("/user/{user_id}/profile")
def get_user_profile(user_id: str):
    db = app.state.EMB_DB_DATA
    if user_id not in db:
        raise HTTPException(status_code=404, detail="user not found")
    return {"user_id": user_id, "profile": db[user_id].get("profile", {})}


@app.patch("/user/profile")
def update_user_profile(update: ProfileUpdate):
    db = app.state.EMB_DB_DATA
    user_id = update.user_id
    if user_id not in db:
        raise HTTPException(status_code=404, detail="user not found")
    prof = db[user_id].setdefault("profile", {})
    for k, v in (update.data or {}).items():
        prof[k] = v
    save_embeddings_db(db)
    return {"success": True, "profile": prof}


@app.post("/retrain")
async def retrain_endpoint():
    return {"accepted": True, "message": "retrain endpoint is a stub — wire training here when ready."}


@app.get("/")
def root():
    # Serve Next.js app if built, else show JSON message
    nextjs_index = os.path.join(NEXTJS_OUT_DIR, "index.html")
    if os.path.exists(nextjs_index):
        return FileResponse(nextjs_index)
    elif os.path.isdir(FRONTEND_DIR):
        return RedirectResponse(url="/frontend")
    return {"message": "Signature Verification Backend running. Frontend not found.", "docs": "/docs"}


@app.get("/_next/{path:path}")
def serve_nextjs_assets(path: str):
    """Serve Next.js static assets"""
    file_path = os.path.join(NEXTJS_OUT_DIR, "_next", path)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Asset not found")


@app.get("/admin")
def admin_page():
    """Serve admin panel page"""
    admin_html = os.path.join(NEXTJS_OUT_DIR, "admin.html")
    if os.path.exists(admin_html):
        return FileResponse(admin_html)
    # Fallback to main page if admin.html not found
    nextjs_index = os.path.join(NEXTJS_OUT_DIR, "index.html")
    if os.path.exists(nextjs_index):
        return FileResponse(nextjs_index)
    return {"message": "Admin panel not found"}


# -------- Static image serving (registered samples) --------
@app.get("/registered_image/{filename}", summary="Get a registered signature image")
def get_registered_image(filename: str):
    """Serve a stored registered signature image by filename."""
    path = os.path.join(SAMPLES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="image not found")
    return FileResponse(path, media_type="image/png")


# -------- Maintenance / Admin Endpoints --------
@app.delete("/user/{user_id}/signatures", summary="Delete all signatures for a user")
def delete_user_signatures(user_id: str):
    db = app.state.EMB_DB_DATA
    if user_id not in db:
        raise HTTPException(status_code=404, detail="user not found")
    # Delete image files for that user
    removed_files = []
    for sample in db[user_id].get("signatures", {}).get("samples", []):
        p = sample.get("path")
        if p and os.path.isfile(p):
            try:
                os.remove(p)
                removed_files.append(p)
            except Exception as e:
                print("Failed removing", p, e)
    # Reset user entry
    entry = db[user_id]
    entry["signatures"] = {"embeddings": [], "mean_embedding": None, "samples": []}
    # Keep profile and face_embedding intact
    save_embeddings_db(db)
    app.state.EMB_DB_DATA = db
    return {"success": True, "user_id": user_id, "removed_files": removed_files, "message": "User signatures cleared."}


@app.delete("/admin/clear_all_signatures", summary="Delete ALL users' signatures and embeddings")
def clear_all_signatures(confirm: str = "no"):
    if confirm.lower() != "yes":
        raise HTTPException(status_code=400, detail="Set confirm=yes to actually perform the purge.")
    db = app.state.EMB_DB_DATA
    # Remove all stored sample images
    removed = []
    for user_id, info in db.items():
        for sample in info.get("signatures", {}).get("samples", []):
            p = sample.get("path")
            if p and os.path.isfile(p):
                try:
                    os.remove(p)
                    removed.append(p)
                except Exception as e:
                    print("Failed removing", p, e)
        # reset user
        entry = db[user_id]
        entry["signatures"] = {"embeddings": [], "mean_embedding": None, "samples": []}
    # Optionally also clear any orphaned files left in directory
    try:
        for fname in os.listdir(SAMPLES_DIR):
            fp = os.path.join(SAMPLES_DIR, fname)
            if os.path.isfile(fp):
                try:
                    os.remove(fp)
                except Exception:
                    pass
    except FileNotFoundError:
        pass
    save_embeddings_db(db)
    app.state.EMB_DB_DATA = db
    return {"success": True, "removed_files": removed, "message": "All signatures purged."}


# ================= Face/Identity APIs =================
try:
    from face_utils import analyze_frame, compare_faces
    FACE_UTILS_AVAILABLE = True
except ImportError:
    print("Warning: face_utils not available. Face verification disabled.")
    FACE_UTILS_AVAILABLE = False
    def analyze_frame(*args, **kwargs):
        return {"status": "error", "message": "Face verification not available"}
    def compare_faces(*args, **kwargs):
        return False


@app.post("/register_user_profile")
def register_user_profile(profile: UserProfile):
    db = app.state.EMB_DB_DATA
    user_id = profile.user_id
    ensure_user_db_entry(db, user_id)
    db[user_id]["profile"] = profile.dict(exclude={"user_id"})
    save_embeddings_db(db)
    return {"success": True, "message": f"Profile for {user_id} created/updated."}


@app.post("/register_face")
async def register_face(payload: FaceRegisterPayload):
    if not OPENCV_AVAILABLE or not FACE_UTILS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Face registration not available. OpenCV not installed.")
    
    db = app.state.EMB_DB_DATA
    user_id = payload.user_id
    if user_id not in db:
        raise HTTPException(status_code=404, detail="User profile not found. Please register profile first.")
    try:
        pil_img = decode_base64_image_rgb(payload.image)
        cv_img = np.array(pil_img, dtype=np.uint8)
        # Convert RGB to BGR with cv2 (ensures contiguous array)
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)

        analysis = analyze_frame(cv_img)
        if analysis["status"] == "error":
            raise HTTPException(status_code=400, detail=analysis["message"])
        if analysis["status"] == "pending":
            raise HTTPException(status_code=400, detail="Could not detect a valid face in the image.")

        db[user_id]["face_embedding"] = analysis["encoding"].tolist()
        save_embeddings_db(db)
        return {"success": True, "message": "Face registered successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@app.post("/detect_faces")
async def detect_faces(request: Request):
    """Real-time face detection endpoint for live feedback"""
    if not OPENCV_AVAILABLE or not FACE_UTILS_AVAILABLE:
        return {"face_count": 0, "message": "Face detection not available"}
    
    try:
        body = await request.json()
        image_b64 = body.get("image")
        
        if not image_b64:
            return {"face_count": 0, "message": "No image provided"}
        
        # Decode image
        pil_img = decode_base64_image_rgb(image_b64)
        cv_img = np.array(pil_img, dtype=np.uint8)
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)
        
        # Quick face detection without full analysis
        import face_recognition
        rgb_frame = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
        rgb_frame = np.ascontiguousarray(rgb_frame)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        return {
            "face_count": len(face_locations),
            "message": f"{len(face_locations)} face(s) detected"
        }
        
    except Exception as e:
        return {"face_count": 0, "message": "Detection error", "error": str(e)}


@app.post("/verify_face")
async def verify_face(payload: FaceRegisterPayload):
    if not OPENCV_AVAILABLE or not FACE_UTILS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Face verification not available. OpenCV not installed.")
    
    db = app.state.EMB_DB_DATA
    user_id = payload.user_id
    
    if user_id not in db or db[user_id].get("face_embedding") is None:
        raise HTTPException(status_code=404, detail="User or face registration not found.")
    
    try:
        pil_img = decode_base64_image_rgb(payload.image)
        cv_img = np.array(pil_img, dtype=np.uint8)
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)

        analysis = analyze_frame(cv_img)
        if analysis["status"] == "error":
            raise HTTPException(status_code=400, detail=analysis["message"])
        if analysis["status"] == "pending":
            raise HTTPException(status_code=400, detail="Could not detect a valid face in the image.")

        known_encoding = db[user_id]["face_embedding"]
        
        # Use balanced tolerance for real-world conditions
        is_match = compare_faces(known_encoding, analysis["encoding"], tolerance=0.5)
        
        # Additional security check: calculate similarity score
        import face_recognition
        face_distances = face_recognition.face_distance([np.array(known_encoding)], analysis["encoding"])
        similarity_score = 1 - face_distances[0]  # Convert distance to similarity
        
        print(f"Face verification - User: {user_id}, Distance: {face_distances[0]:.3f}, Similarity: {similarity_score:.3f}")
        
        # Use more reasonable similarity threshold for different backgrounds/lighting
        if is_match and similarity_score >= 0.50:  # Require 50% similarity minimum (more realistic)
            return {
                "success": True, 
                "verified": True, 
                "message": "Face verified successfully!",
                "similarity": float(similarity_score)
            }
        else:
            return {
                "success": True, 
                "verified": False, 
                "message": f"Face does not match registered face. Similarity: {similarity_score:.1%}",
                "similarity": float(similarity_score)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@app.websocket("/ws/verify/{user_id}")
async def websocket_verify(websocket: WebSocket, user_id: str):
    await websocket.accept()
    db = app.state.EMB_DB_DATA
    if user_id not in db or db[user_id].get("face_embedding") is None:
        await websocket.send_json({"status": "error", "message": "User or face registration not found."})
        await websocket.close()
        return

    known_encoding = db[user_id]["face_embedding"]

    try:
        while True:
            data = await websocket.receive_text()
            pil_img = decode_base64_image_rgb(data)
            cv_img = np.array(pil_img, dtype=np.uint8)
            cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)

            analysis = analyze_frame(cv_img)
            if analysis["status"] != "ok":
                await websocket.send_json(analysis)
                continue

            # Use balanced tolerance for WebSocket verification too
            is_match = compare_faces(known_encoding, analysis["encoding"], tolerance=0.5)
            
            # Calculate similarity for debugging
            import face_recognition
            face_distances = face_recognition.face_distance([np.array(known_encoding)], analysis["encoding"])
            similarity_score = 1 - face_distances[0]
            
            if is_match and similarity_score >= 0.50:
                await websocket.send_json({
                    "status": "verified", 
                    "message": "User verified successfully!",
                    "similarity": float(similarity_score)
                })
            else:
                await websocket.send_json({
                    "status": "mismatch", 
                    "message": f"Face does not match. Similarity: {similarity_score:.1%}",
                    "similarity": float(similarity_score)
                })

    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected.")
    except Exception as e:
        print(f"Error in websocket for {user_id}: {e}")
        try:
            await websocket.send_json({"status": "error", "message": "An internal server error occurred."})
        except Exception:
            pass


@app.post("/admin/clear-database")
def clear_database():
    """Clear all user data for fresh start"""
    try:
        # Clear the in-memory database
        app.state.EMB_DB_DATA.clear()
        
        # Clear the JSON file
        with open(EMBED_DB, "w", encoding="utf-8") as f:
            json.dump({}, f)
        
        # Clear registered images
        import shutil
        registered_images_path = "registered_images"
        if os.path.exists(registered_images_path):
            shutil.rmtree(registered_images_path)
            os.makedirs(registered_images_path, exist_ok=True)
        
        return {"status": "success", "message": "Database cleared successfully"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to clear database: {str(e)}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
