(function() {
  var GRID_RES;

  GRID_RES = 32;

  window.begin = function() {
    var canvas, context, count, gridToScreen, height, modes, nextMode, screenToGrid, setMode, targetLoop, walls, width;
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    width = canvas.width;
    height = canvas.height;
    screenToGrid = function(x, y) {
      return new Point(Math.floor(x / GRID_RES), Math.floor(y / GRID_RES));
    };
    gridToScreen = function(point) {
      return new Point(point.x * GRID_RES, point.y * GRID_RES);
    };
    window.path = [];
    walls = new PointSet();
    modes = ["avoid", "seek", "seek", "strafe-ccw", "strafe-ccw", "strafe-cw", "strafe-cw"];
    window.mode = null;
    setMode = function(mode) {
      Game.ws.send(JSON.stringify({
        type: "name",
        name: "bot: " + mode
      }));
      return window.mode = mode;
    };
    nextMode = function() {
      setMode(modes[Math.floor(Math.random() * modes.length)]);
      return setTimeout(nextMode, Math.random() * 2000);
    };
    nextMode();
    Game.drawCallbacks.push(function(context) {
      var p, point, _i, _j, _len, _len2, _ref;
      for (_i = 0, _len = path.length; _i < _len; _i++) {
        point = path[_i];
        p = gridToScreen(point);
        context.fillStyle = "rgba(255, 0, 0, 0.4)";
        context.fillRect(p.x, p.y, GRID_RES, GRID_RES);
      }
      _ref = walls.values();
      for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
        point = _ref[_j];
        p = gridToScreen(point);
        context.fillStyle = "rgba(128, 128, 128, 0.5)";
        context.fillRect(p.x, p.y, GRID_RES, GRID_RES);
      }
      if (window.nx && window.ny && window.myPoint && mode.match(/strafe/)) {
        context.beginPath();
        context.moveTo(myScreenPoint.x, myScreenPoint.y);
        if (mode === "strafe-ccw") {
          context.lineTo(myScreenPoint.x + nx * 100, myScreenPoint.y + ny * 100);
        } else if (mode === "strafe-cw") {
          context.lineTo(myScreenPoint.x - nx * 100, myScreenPoint.y - ny * 100);
        }
        context.strokeStyle = "green";
        context.lineWidth = 2;
        context.stroke();
      }
      context.font = "48px Menlo";
      context.textAlign = "center";
      context.fillStyle = "rgba(128, 64, 64, 0.5)";
      return context.fillText(mode, width / 2, 100);
    });
    count = 0;
    targetLoop = function() {
      var distance, dx, dy, keys, line, point, scatter, scatterFactor, targetPoint, x, y, _i, _len, _ref, _ref2, _ref3, _ref4;
      count++;
      window.target = Game.world.players.filter(function(p) {
        return !p.you && !p.dead;
      }).sort(function(a, b) {
        return b.health - a.health;
      }).pop();
      window.me = Game.world.players.filter(function(p) {
        return p.you;
      })[0];
      window.wallLines = Game.world.walls;
      walls = new PointSet;
      for (_i = 0, _len = wallLines.length; _i < _len; _i++) {
        line = wallLines[_i];
        if (line.a.x === line.b.x) {
          for (y = _ref = line.a.y, _ref2 = line.b.y; _ref <= _ref2 ? y <= _ref2 : y >= _ref2; y += GRID_RES) {
            walls.add(new Point(Math.floor(line.a.x / GRID_RES), Math.floor(y / GRID_RES)));
          }
        }
        if (line.a.y === line.b.y) {
          for (x = _ref3 = line.a.x, _ref4 = line.b.x; _ref3 <= _ref4 ? x <= _ref4 : x >= _ref4; x += GRID_RES) {
            walls.add(new Point(Math.floor(x / GRID_RES), Math.floor(line.a.y / GRID_RES)));
          }
        }
      }
      window.myScreenPoint = new Point(me.pos.x, me.pos.y);
      window.myPoint = screenToGrid(me.pos.x, me.pos.y);
      if (!target) return;
      targetPoint = screenToGrid(target.pos.x, target.pos.y);
      window.path = aStar(myPoint, targetPoint, walls, 256);
      if (path.length <= 1) return;
      if (path.length < 4 && !mode.match(/strafe/)) {
        setMode(["strafe-cw", "strafe-ccw"][Math.floor(Math.random() * 2)]);
      }
      dx = target.pos.x - me.pos.x;
      dy = target.pos.y - me.pos.y;
      distance = Math.sqrt(dx * dx + dy * dy);
      window.nx = -dy / distance;
      window.ny = +dx / distance;
      point = path[1];
      keys = [];
      if (mode === "seek") {
        if (point.x > myPoint.x) keys.push("right");
        if (point.x < myPoint.x) keys.push("left");
        if (point.y < myPoint.y) keys.push("up");
        if (point.y > myPoint.y) keys.push("down");
      } else if (mode === "avoid") {
        if (point.x > myPoint.x) keys.push("left");
        if (point.x < myPoint.x) keys.push("right");
        if (point.y < myPoint.y) keys.push("down");
        if (point.y > myPoint.y) keys.push("up");
      } else if (mode === "strafe-ccw") {
        if (nx > 0) keys.push("right");
        if (nx < 0) keys.push("left");
        if (ny > 0) keys.push("down");
        if (ny < 0) keys.push("up");
      } else if (mode === "strafe-cw") {
        if (nx > 0) keys.push("left");
        if (nx < 0) keys.push("right");
        if (ny > 0) keys.push("up");
        if (ny < 0) keys.push("down");
      }
      Game.ws.send(JSON.stringify({
        type: "move",
        keys: keys
      }));
      if (count % 10 === 0) {
        scatterFactor = Math.max(0, distance - 50) / 4;
        scatter = Math.random() * scatterFactor - (scatterFactor / 2);
        return Game.ws.send(JSON.stringify({
          type: "shoot",
          x: target.pos.x + scatter,
          y: target.pos.y + scatter
        }));
      }
    };
    return window.setInterval(targetLoop, 10);
  };

  (function() {
    var script;
    script = document.createElement("script");
    script.addEventListener("load", begin);
    script.src = "http://paulbookpro.local:8000/js/astar.js";
    return document.body.appendChild(script);
  })();

}).call(this);
