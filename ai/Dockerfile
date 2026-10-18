FROM python:3.12-slim

ARG FACEFUSION_COMMIT=72470819a0373be3388b3929c8f8f311f418fc3c

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git curl libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    torch==2.9.1+cu128 \
    torchvision==0.24.1+cu128 \
    torchaudio==2.9.1+cu128 \
    --index-url https://download.pytorch.org/whl/cu128

RUN git clone https://github.com/facefusion/facefusion.git /opt/facefusion \
    && git -C /opt/facefusion checkout ${FACEFUSION_COMMIT} \
    && cd /opt/facefusion \
    && python install.py cuda@12 --skip-conda

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# faster-whisper pulls the CPU package after FaceFusion's CUDA installer.
# Keep a single ONNX Runtime implementation so FaceFusion actually uses the GPU.
RUN pip uninstall -y onnxruntime onnxruntime-gpu \
    && pip install --no-cache-dir onnxruntime-gpu==1.24.4

COPY . .

ENV PYTHONUNBUFFERED=1 \
    MODEL_CACHE_DIR=/models \
    HF_HOME=/models/huggingface \
    TORCH_HOME=/models/torch \
    FACEFUSION_PATH=/opt/facefusion \
    LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/nvidia/cuda_runtime/lib:/usr/local/lib/python3.12/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.12/site-packages/nvidia/cudnn/lib:/usr/local/lib/python3.12/site-packages/nvidia/cufft/lib:/usr/local/lib/python3.12/site-packages/nvidia/curand/lib

CMD ["python", "-m", "src.worker"]
