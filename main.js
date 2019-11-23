const express = require('express');
const fs = require('fs');

var app = express()
app.use(express.static('public'));

var path = require('path');

const basicAuth = require('express-basic-auth')

var staticUserAuth = basicAuth({
    authorizer: myAuthorizer,
    challenge: true
})

app.get('/accumulate', staticUserAuth, function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
})

function myAuthorizer(username, password) {
    console.log(fs.readFileSync(__dirname + "/auth.json", 'UTF-8'));

    let passw = JSON.parse(fs.readFileSync(__dirname + "/auth.json", 'UTF-8'));
    return username === "accumulate" && password === passw.passw;
}

app.listen(8888)