FROM php:8.2-cli@sha256:118ef4fb1db5e866fb604f2f260da81f819a0a1eac87a4083f9194f48e00beee
RUN apt-get update && apt-get install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libonig-dev \
    && docker-php-ext-configure gd --with-jpeg \
    && docker-php-ext-install gd mbstring \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/.dev/wiki
CMD ["php", "-d", "opcache.enable=0", "-d", "display_errors=1", "-d", "error_reporting=32767", "-S", "0.0.0.0:8088", "router.php"]
