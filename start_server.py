import uvicorn
from signature_verification import app

if __name__ == "__main__":
    print("Starting FastAPI server...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")