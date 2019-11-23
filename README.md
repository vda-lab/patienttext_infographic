# Patienttext Infographic

## Required

Create a **auth.json** file with the following structure:
```
{ "passw": "[password]" }
```
Default username: "accumulate".

## Start with node
Start application with 
```
node main.js
```
Surf to [http://localhost:8888/accumulate](http://localhost:8888/accumulate)

## Start with docker
Build container
```
docker build -t accumulate-node .
```

Run container
```
docker run -p [port]:8888 -d accumulate-node
```
Surf to [http://localhost:[port]/accumulate](http://localhost:8888/accumulate)
