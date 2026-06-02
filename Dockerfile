# Stage 1: Build the React application
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖定义
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci

# 复制源代码并构建
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# 将自定义 Nginx 配置复制到容器
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 将第一阶段构建产物复制到 Nginx 默认静态文件目录
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
