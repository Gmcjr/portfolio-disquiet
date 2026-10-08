FROM node:22-slim
RUN apt-get update && apt-get install -y ripgrep fd-find && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/fdfind /usr/local/bin/fd
RUN npm install -g @earendil-works/pi-coding-agent
WORKDIR /workspace
CMD ["pi"]
