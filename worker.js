const net = require("net");
const fetch = require("node-fetch");
const concurrentRequests = 1;

const server = net.createServer(async (conn) => {
  let result;
  let depth = 0;
  let foundOnOther = false;

  conn.on("end", () => {
    console.log("connection ended");
    foundOnOther = true;
  });

  const processLinks = async (parentLinks, goal) => {
    let newLinks = [];
    let goalFound = false;
    let shortestPath = [];
    while (parentLinks.length > 0 && !foundOnOther) {
      const removedLinks = parentLinks.splice(0, concurrentRequests);
      const promises = removedLinks.map(async (el) => {
        console.log(
          `processing "${encodeURIComponent(
            el[el.length - 1].split(" ").join("_")
          )}"`
        );
        let url = `https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&titles=${encodeURIComponent(
          el[el.length - 1].split(" ").join("_")
        )}&prop=links&pllimit=max`;
        let urlContinue = "";
        while (!foundOnOther) {
          try {
            let response = await fetch(url + urlContinue, {
              headers: {
                "User-Agent":
                  "shortestPathWiki/0.0 (valtteri.haemaelaeinen@gmail.com) node-fetch/2.6.1",
              },
            });
            urlContinue = "";
            let data = await response.json();
            let pageKey = Object.keys(data.query.pages)[0];
            let links = data.query.pages[pageKey].links;
            if (
              links.some((el2) => {
                let tempArr = [...el];
                tempArr.push(el2.title);
                newLinks.push(tempArr);
                if (el2.title === goal) {
                  //Shortest path found!
                  shortestPath = [...el];
                  shortestPath.push(el2.title);
                  return true;
                }
              })
            ) {
              result = shortestPath;
              goalFound = true;
            }
            if ("continue" in data && !goalFound && !foundOnOther) {
              urlContinue = `&plcontinue=${data.continue.plcontinue}`;
            } else {
              break;
            }
          } catch (error) {
            console.log("error with: " + el[el.length - 1]);
            break;
          }
        }
      });
      if (goalFound) break;
      await Promise.all(promises);
    }
    if (goalFound || foundOnOther) {
      return;
    } else {
      console.log("\ngoing deeper in search tree\n");
      depth = depth + 1;
      data = {
        type: "depth",
        value: depth,
      };
      conn.write(JSON.stringify(data));
      await processLinks(newLinks, goal);
    }
  };

  conn.on("data", async (tcpData) => {
    tcpData = JSON.parse(tcpData);
    let links = [];
    tcpData.links.forEach((el) => {
      const path = [tcpData.startPage, el];
      links.push(path);
    });

    await processLinks(links, tcpData.endPage);
    if (!foundOnOther) {
      console.log("Path found!");
      data = {
        type: "result",
        depth: depth,
        path: result,
      };
      conn.write(JSON.stringify(data));
    }
  });
});

server.listen(process.argv[2]);
