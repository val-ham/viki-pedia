const net = require("net");
const readline = require("readline");
const rl = readline.createInterface(process.stdin, process.stdout);

const conn = net.createConnection({ port: 9090, host: "localhost" }, () => {
  console.log("Connected.");
  rl.question("Enter start page: ", (startPage) => {
    rl.question("Enter end page: ", (endPage) => {
      data = {
        startPage: startPage,
        endPage: endPage,
      };
      conn.write(JSON.stringify(data));
      rl.close();
    });
  });
  conn.on("data", (data) => {
    data = JSON.parse(data);
    if (data.type === "error") console.log(data.msg);
    if (data.type === "success") {
      console.log(`Shortest path is:`);
      data.path.forEach((el) => console.log(`->${el}`));
    }
    conn.end();
  });
});
