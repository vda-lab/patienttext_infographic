FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

EXPOSE 8888
CMD [ "node", "main.js" ]
