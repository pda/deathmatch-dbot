(function() {
  var GRID_RES;

  GRID_RES = 32;

  window.begin = function() {
    var canvas, context, count, gridToScreen, height, modes, nextMode, playerPoint, screenToGrid, setMode, targetHistory, targetLoop, walls, width;
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    width = canvas.width;
    height = canvas.height;
    playerPoint = function(player) {
      return new Point(player.pos.x, player.pos.y);
    };
    screenToGrid = function(point) {
      return new Point(Math.floor(point.x / GRID_RES), Math.floor(point.y / GRID_RES));
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
      if (window.nx && window.ny && window.gridMe && mode.match(/strafe/)) {
        context.beginPath();
        context.moveTo(screenMe.x, screenMe.y);
        if (mode === "strafe-ccw") {
          context.lineTo(screenMe.x + nx * 100, screenMe.y + ny * 100);
        } else if (mode === "strafe-cw") {
          context.lineTo(screenMe.x - nx * 100, screenMe.y - ny * 100);
        }
        context.strokeStyle = "rgba(255, 0, 0, 0.5)";
        context.lineWidth = 2;
        context.stroke();
      }
      if (window.shootTarget && window.screenTarget) {
        context.beginPath();
        context.moveTo(screenTarget.x, screenTarget.y);
        context.lineTo(shootTarget.x, shootTarget.y);
        context.strokeStyle = "green";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = "rgba(0, 196, 0, 0.5)";
        context.fillRect(shootTarget.x - 8, shootTarget.y - 8, 16, 16);
      }
      context.font = "48px Menlo";
      context.textAlign = "center";
      context.fillStyle = "rgba(128, 64, 64, 0.5)";
      return context.fillText(mode, width / 2, 100);
    });
    targetHistory = {
      id: null,
      point: null
    };
    count = 0;
    targetLoop = function() {
      var distance, dx, dy, gridTarget, keys, leadFactor, line, point, scatter, scatterFactor, st, x, y, _i, _len, _ref, _ref2, _ref3, _ref4;
      count++;
      window.me = Game.world.players.filter(function(p) {
        return p.you;
      })[0];
      window.target = Game.world.players.filter(function(p) {
        return !p.you && !p.dead;
      }).sort(function(a, b) {
        return b.health - a.health;
      }).pop();
      if (!target) return;
      if (!window.wallLines) {
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
      }
      window.screenMe = playerPoint(me);
      window.gridMe = screenToGrid(screenMe);
      window.screenTarget = playerPoint(target);
      gridTarget = screenToGrid(screenTarget);
      dx = target.pos.x - me.pos.x;
      dy = target.pos.y - me.pos.y;
      distance = Math.sqrt(dx * dx + dy * dy);
      window.nx = -dy / distance;
      window.ny = +dx / distance;
      if (count % 10 === 0) {
        scatterFactor = Math.max(0, distance - 50) / 4;
        scatter = Math.random() * scatterFactor - (scatterFactor / 2);
        leadFactor = distance * 0.01;
        if (targetHistory.id === target.id) {
          st = screenTarget;
          window.shootTarget = new Point(st.x + (st.x - targetHistory.point.x) * leadFactor, st.y + (st.y - targetHistory.point.y) * leadFactor);
        } else {
          window.shootTarget = screenTarget;
        }
        targetHistory = {
          id: target.id,
          point: screenTarget
        };
        Game.ws.send(JSON.stringify({
          type: "shoot",
          x: shootTarget.x,
          y: shootTarget.y
        }));
      }
      window.path = aStar(gridMe, gridTarget, walls, 128);
      if (path.length <= 1) return;
      if (path.length < 4 && !mode.match(/strafe/)) {
        setMode(["strafe-cw", "strafe-ccw"][Math.floor(Math.random() * 2)]);
      }
      point = path[1];
      keys = [];
      if (mode === "seek") {
        if (point.x > gridMe.x) keys.push("right");
        if (point.x < gridMe.x) keys.push("left");
        if (point.y < gridMe.y) keys.push("up");
        if (point.y > gridMe.y) keys.push("down");
      } else if (mode === "avoid") {
        if (point.x > gridMe.x) keys.push("left");
        if (point.x < gridMe.x) keys.push("right");
        if (point.y < gridMe.y) keys.push("down");
        if (point.y > gridMe.y) keys.push("up");
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
      return Game.ws.send(JSON.stringify({
        type: "move",
        keys: keys
      }));
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
