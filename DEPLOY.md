# Deployment Guide (AWS EC2 + FastAPI + Nginx)

This is a simple step-by-step guide to deploy the Ai-checker project on an AWS EC2 Ubuntu server.

---

## 1️ Create AWS Account & Launch EC2

1. Create an AWS account.
2. Launch a new EC2 instance:
   - OS: Ubuntu (22.04 recommended)
   - Instance type: t2.micro (or higher if needed)
   - Create/select a key pair

### Security Group Settings

While creating the instance, add these inbound rules:

- HTTP – TCP – Port 80 – 0.0.0.0/0  
- HTTPS – TCP – Port 443 – 0.0.0.0/0  
- Custom TCP – Port 0-65535 – 0.0.0.0/0  
- SSH – TCP – Port 22 – Your IP only (example: 103.59.75.109/32)

---

# Backend Setup (FastAPI)

---

## 2️ Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## 3️ Update Server & Install Required Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv git nginx -y
```

---

## 4️ Clone the Project

```bash
git clone https://github.com/Durgeshhhhhh/Ai-checker/
cd Ai-checker
```

---

## 5️ Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn uvicorn
```

---

## 6️ Create .env File

```bash
sudo nano .env
```

Add your environment variables and save the file.

---

## 7️ Test the App with Gunicorn

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:8000
```

If it works, press `CTRL + C` to stop it.

---

## 8️ Create Systemd Service (Auto Start)

```bash
sudo nano /etc/systemd/system/ai-detector.service
```

Paste this:

```
[Unit]
Description=AI Detector FastAPI App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/Ai-checker
ExecStart=/home/ubuntu/Ai-checker/venv/bin/gunicorn -w 1 -k uvicorn.workers.UvicornWorker app:app --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl start ai-detector
sudo systemctl enable ai-detector
```

To check status:

```bash
sudo systemctl status ai-detector
```

---

# Nginx Configuration

---

## 9️ Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/Ai-checker
```

Paste this:

```
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/Ai-checker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

# Frontend Setup (Production)

---

##  Build Frontend

Install npm if needed:

```bash
sudo apt install npm -y
```

Then build:

```bash
npm run build
```

This will create a `dist/` folder.

---

## 1️1️ Move dist Folder to Nginx

```bash
sudo rm -rf /var/www/aichecker
sudo mkdir -p /var/www/aichecker
sudo cp -r ~/Ai-checker/dist/* /var/www/aichecker/
sudo chown -R www-data:www-data /var/www/aichecker
sudo chmod -R 755 /var/www/aichecker
```

---

## 1️2️ Update Default Nginx File

```bash
sudo nano /etc/nginx/sites-available/default
```

Replace with:

```
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    root /var/www/aichecker;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Restart Nginx:

```bash
sudo systemctl restart nginx
```

---

# Done 

Now open your browser and visit:

```
http://YOUR_EC2_PUBLIC_IP
```

Your backend and frontend should both be working.

---

