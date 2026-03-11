db.createUser({
  user: "replog",
  pwd: "replog",
  roles: [{ role: "readWrite", db: "replog" }],
});
