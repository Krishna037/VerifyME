import cv2
import numpy as np
import face_recognition


def analyze_frame(frame: np.ndarray):
    """
    Analyze a single BGR frame for face detection and simple quality heuristics.
    Returns a dict: {status: 'ok'|'error'|'pending', message: str, encoding?: np.ndarray}
    """
    if frame is None or frame.size == 0:
        return {"status": "error", "message": "Empty frame received."}

    # Convert BGR (OpenCV) -> RGB for face_recognition using cv2 (ensures contiguous memory)
    if frame.dtype != np.uint8:
        frame = frame.astype(np.uint8, copy=False)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame = np.ascontiguousarray(rgb_frame)

    # Detect faces and encodings
    face_locations = face_recognition.face_locations(rgb_frame)
    if len(face_locations) == 0:
        return {"status": "pending", "message": "No face detected."}
    if len(face_locations) > 1:
        return {"status": "error", "message": "Multiple faces detected. Please ensure only you are in the frame."}

    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
    if not face_encodings:
        return {"status": "pending", "message": "Face not suitable for encoding. Adjust position/lighting."}

    # Lighting heuristic via brightness of grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    if brightness < 70:
        return {"status": "error", "message": "Poor lighting. Please move to a brighter area."}
    if brightness > 185:
        return {"status": "error", "message": "Lighting is too bright. Please reduce glare."}

    return {"status": "ok", "message": "Face detected.", "encoding": face_encodings[0]}


def compare_faces(known_encoding, unknown_encoding: np.ndarray, tolerance: float = 0.5) -> bool:
    """Compare a known encoding (list or np.array) with unknown encoding and return True if match."""
    if known_encoding is None:
        return False
    known = np.array(known_encoding)
    
    # Use balanced tolerance - secure but not too strict
    matches = face_recognition.compare_faces([known], unknown_encoding, tolerance=tolerance)
    
    # Additional check: calculate face distance for extra validation
    face_distances = face_recognition.face_distance([known], unknown_encoding)
    
    print(f"Face comparison - Distance: {face_distances[0]:.3f}, Tolerance: {tolerance}, Match: {matches[0]}")
    
    # Single verification: use the match result (already includes distance check)
    return bool(matches[0])
