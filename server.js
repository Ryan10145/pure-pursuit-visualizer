const express = require("express");
const app = express();

app.use(express.static(__dirname + "/docs"))

app.get("/", (request, response) => {
    response.sendFile(__dirname + "/index.html");
})

let port = process.env.PORT;
if(port == null || port == "") {
    port = 1257;
}

app.listen(port, () => {
    console.log("Server is now running...");
});
