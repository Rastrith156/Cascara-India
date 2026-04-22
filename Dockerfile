FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

# Copy nginx config with API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend files
COPY index.html products.html brew.html reviews.html checkout.html login.html signup.html robots.txt sitemap.xml ./
COPY app.js style.css ./
COPY *.png ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
