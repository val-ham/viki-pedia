const fetch = require("node-fetch");
const net = require("net");

const server = net.createServer(async (conn) => {
  conn.on("error", (err) => console.log(err));
  conn.on("data", async (tcpData) => {
    tcpData = JSON.parse(tcpData);

    let endPageRes = await fetch(
      `https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&titles=${tcpData.endPage}&prop=links&pllimit=max`
    );
    let endPageData = await endPageRes.json();
    if (endPageData.query.pages.hasOwnProperty("-1")) {
      conn.write(
        JSON.stringify({ type: "error", msg: "Error with end page." })
      );
      conn.end();
      return;
    }

    let url = `https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&titles=${tcpData.startPage}&prop=links&pllimit=max`;
    let urlContinue = "";
    let linksFound = [];
    let found = false;
    while (true) {
      try {
        let response = await fetch(url + urlContinue);
        urlContinue = "";
        let data = await response.json();
        let pageKey = Object.keys(data.query.pages)[0];
        let links = data.query.pages[pageKey].links;
        links.forEach((el) => {
          if (el.title === tcpData.endPage) {
            conn.write(
              JSON.stringify({
                type: "success",
                path: [tcpData.startPage, tcpData.endPage],
              })
            );
            found = true;
            return;
          }
          linksFound.push(el.title);
        });
        if (found) return;
        if ("continue" in data) {
          urlContinue = `&plcontinue=${data.continue.plcontinue}`;
        } else {
          break;
        }
      } catch (error) {
        conn.write(
          JSON.stringify({ type: "error", msg: "Error with start page." })
        );
        conn.end();
        return;
        break;
      }
    }
    console.log(`Links on page "${tcpData.startPage}": ${linksFound.length}`);
    //divide links to half
    let halfIndex = linksFound.length / 2;
    let l1 = linksFound.slice(0, halfIndex);
    let l2 = linksFound.slice(halfIndex);
    //open 2 tcp connections (ports 9091, 9092)
    const tcp1 = net.createConnection({ port: 9091, host: "localhost" }, () => {
      data = {
        startPage: tcpData.startPage,
        endPage: tcpData.endPage,
        links: l1,
      };
      tcp1.write(JSON.stringify(data));
    });

    const tcp2 = net.createConnection({ port: 9092, host: "localhost" }, () => {
      data = {
        startPage: tcpData.startPage,
        endPage: tcpData.endPage,
        links: l2,
      };
      tcp2.write(JSON.stringify(data));
    });

    let tcp1Depth = 0;
    let tcp2Depth = 0;
    let result = [];

    tcp1.on("data", (data) => {
      data = JSON.parse(data);
      switch (data.type) {
        case "depth":
          tcp1Depth = data.value;
          if (result.length > 0 && tcp1Depth > tcp2Depth) {
            tcp1.end();
          }
          break;
        case "result":
          result = data.path;
          if (tcp1Depth <= tcp2Depth) {
            tcp1.end();
            tcp2.end();
            console.log(
              `Shortest path found for ${tcpData.startPage} => ${tcpData.endPage}`
            );
            conn.write(JSON.stringify({ type: "success", path: result }));
          }
        default:
          break;
      }
    });

    tcp2.on("data", (data) => {
      data = JSON.parse(data);
      switch (data.type) {
        case "depth":
          if (result.length > 0 && tcp2Depth > tcp1Depth) {
            tcp2.end();
          }
          tcp2Depth = data.value;
          break;
        case "result":
          result = data.path;
          if (tcp2Depth <= tcp1Depth) {
            tcp1.end();
            tcp2.end();
            console.log(
              `Shortest path found for ${tcpData.startPage} => ${tcpData.endPage}`
            );
            conn.write(JSON.stringify({ type: "success", path: result }));
          }
        default:
          break;
      }
    });
  });
});

server.listen(9090);
