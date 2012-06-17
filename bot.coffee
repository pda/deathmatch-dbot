GRID_RES = 32

window.begin = ->
  canvas = document.getElementById("canvas")
  context = canvas.getContext("2d")
  width = canvas.width
  height = canvas.height

  playerPoint = (player) ->
    new Point(player.pos.x, player.pos.y)

  screenToGrid = (point) ->
    new Point(Math.floor(point.x / GRID_RES), Math.floor(point.y / GRID_RES))

  gridToScreen = (point) ->
    new Point(point.x * GRID_RES, point.y * GRID_RES)

  window.path = []

  walls = new PointSet()

  modes = [
    "avoid"
    "seek"
    "seek"
    "strafe-ccw"
    "strafe-ccw"
    "strafe-cw"
    "strafe-cw"
  ]

  window.mode = null
  setMode = (mode) ->
    Game.ws.send JSON.stringify({type: "name", name: "bot: #{mode}"})
    window.mode = mode
  nextMode = ->
    setMode(modes[Math.floor(Math.random() * modes.length)])
    setTimeout(nextMode, Math.random() * 2000)
  nextMode()

  Game.drawCallbacks.push (context) ->
    for point in path
      p = gridToScreen(point)
      context.fillStyle = "rgba(255, 0, 0, 0.4)"
      context.fillRect(p.x, p.y, GRID_RES, GRID_RES)
    for point in walls.values()
      p = gridToScreen(point)
      context.fillStyle = "rgba(128, 128, 128, 0.5)"
      context.fillRect(p.x, p.y, GRID_RES, GRID_RES)
    if window.nx && window.ny && window.gridMe && mode.match(/strafe/)
      context.beginPath()
      context.moveTo(screenMe.x, screenMe.y)
      if mode == "strafe-ccw"
        context.lineTo(screenMe.x + nx * 100, screenMe.y + ny * 100)
      else if mode == "strafe-cw"
        context.lineTo(screenMe.x - nx * 100, screenMe.y - ny * 100)
      context.strokeStyle = "green"
      context.lineWidth = 2
      context.stroke()
    context.font = "48px Menlo"
    context.textAlign = "center"
    context.fillStyle = "rgba(128, 64, 64, 0.5)"
    context.fillText(mode, width / 2, 100)

  count = 0
  targetLoop = ->
    count++

    window.me = Game.world.players.filter((p) -> p.you)[0]
    window.target = Game.world.players.
      filter((p) -> !p.you && !p.dead).
      sort((a, b) -> b.health - a.health).
      pop()

    if !target then return

    if !window.wallLines
      window.wallLines = Game.world.walls
      walls = new PointSet
      for line in wallLines
        if line.a.x == line.b.x # vertical
          for y in [line.a.y..line.b.y] by GRID_RES
            walls.add(new Point(Math.floor(line.a.x / GRID_RES), Math.floor(y / GRID_RES)))
        if line.a.y == line.b.y # horizontal
          for x in [line.a.x..line.b.x] by GRID_RES
            walls.add(new Point(Math.floor(x / GRID_RES), Math.floor(line.a.y / GRID_RES)))

    window.screenMe = playerPoint(me)
    window.gridMe = screenToGrid(screenMe)
    screenTarget = playerPoint(target)
    gridTarget = screenToGrid(screenTarget)

    window.path = aStar(gridMe, gridTarget, walls, 256)

    if path.length <= 1
      return
    if path.length < 4 && !mode.match(/strafe/)
      setMode(["strafe-cw", "strafe-ccw"][Math.floor(Math.random() * 2)])

    dx = target.pos.x - me.pos.x
    dy = target.pos.y - me.pos.y
    distance = Math.sqrt(dx * dx + dy * dy)
    window.nx = -dy / distance
    window.ny = +dx / distance

    point = path[1]

    keys = []
    if mode == "seek"
      if point.x > gridMe.x then keys.push("right")
      if point.x < gridMe.x then keys.push("left")
      if point.y < gridMe.y then keys.push("up")
      if point.y > gridMe.y then keys.push("down")
    else if mode == "avoid"
      if point.x > gridMe.x then keys.push("left")
      if point.x < gridMe.x then keys.push("right")
      if point.y < gridMe.y then keys.push("down")
      if point.y > gridMe.y then keys.push("up")
    else if mode == "strafe-ccw"
      if nx > 0 then keys.push("right")
      if nx < 0 then keys.push("left")
      if ny > 0 then keys.push("down")
      if ny < 0 then keys.push("up")
    else if mode == "strafe-cw"
      if nx > 0 then keys.push("left")
      if nx < 0 then keys.push("right")
      if ny > 0 then keys.push("up")
      if ny < 0 then keys.push("down")

    Game.ws.send JSON.stringify({type: "move", keys: keys})
    if count % 10 == 0
      scatterFactor = Math.max(0, distance - 50) / 4
      scatter = Math.random() * scatterFactor - (scatterFactor / 2)
      Game.ws.send JSON.stringify({type: "shoot", x: target.pos.x + scatter, y: target.pos.y + scatter})

  window.setInterval(targetLoop, 10)

(->
  script = document.createElement("script")
  script.addEventListener("load", begin)
  script.src = "http://paulbookpro.local:8000/js/astar.js"
  document.body.appendChild(script)
)()
