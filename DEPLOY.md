# Deployment Guide (EC2 + Nginx + FastAPI)

create the AWS A/C after that create the instance with the required and avaiable resources 

### (1) After creating the intances fallow the required command 
At the time of creating the instance create the security group 
1) 80 - TCP - 0.0.0.0/0 - launch-wizard-3 
2) (0 - 65535)- TCP - 0.0.0.0/0 - launch-wizard-3 
3) 443 - TCP - 0.0.0.0/0 - launch-wizard-3 
4) 22 - TCP - 103.59.75.109/32 - launch-wizard-3  

#### step 1 -: connect the instance 

#### step 2 -: update the ubuntu and install the dependency 


sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv git nginx -y

#### step 3 -:  STEP 3 — Clone the Project from github 

git clone https://github.com/Durgeshhhhhh/Ai-checker/
cd Ai-checker

#### step 4-: create the virtual enviornment 

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn uvicorn

#### step 5-: create .env file in the EC2 server

sudo nano .env 

#### step 6-:  Setup Gunicorn (Production Server)

gunicorn -w 4 -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:8000

#### step 7-: STEP 8 — Create Systemd Service (Auto Start)

sudo nano /etc/systemd/system/ai-detector.service 
                                                                       
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

#### after creating the file run this command -:
sudo systemctl daemon-reload
sudo systemctl start Ai-checker
sudo systemctl enable Ai-checker

#### If want to check the status then run -: 
sudo systemctl status ai-detector
 

#### step 8-: sudo nano /etc/nginx/sites-available/Ai-checker 

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

#### step 9-: start the server 
sudo systemctl restart Ai-checker

#### step 10 -: If u want to use frontend then -:
##### 1)Instal npm
##### 2) npm build 

The above command will build the dist/ folder then that folder we will use for the production because it contain only plain Html codde 

#### step 11 -: After building the Dist use it with nginx so instead of using the frontend folder it will use dist for the production 

##### run this command one by one -: 
sudo rm -rf /var/www/aichecker
sudo mkdir -p /var/www/aichecker
sudo cp -r ~/Ai-checker/dist/* /var/www/aichecker/
sudo chown -R www-data:www-data /var/www/aichecker
 sudo chmod -R 755 /var/www/aichecker
 sudo nano /etc/nginx/sites-available/default
 paste this code -: 

 server {
    listen 80;
    server_name 40.192.99.138;

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


 #### step -12  sudo systemctl restart nginx 
 After the above command the server will start and frontend will be visible 
 
