FROM node:6

RUN mkdir /app
ADD . /app
WORKDIR /app
RUN npm install --no-dev

EXPOSE 8124

CMD npm start