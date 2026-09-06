const path = require("path");
const express = require("express");
const routes = require("./src/routes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use("/api", routes);
app.use(express.static(path.join(__dirname, "public")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Lottery app running at http://localhost:${PORT}`);
});
