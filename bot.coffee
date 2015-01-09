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

  drawBox = (c, x, y, width, height, style) ->
    c.fillStyle = style
    c.fillRect(x, y, width, height)

  drawLine = (c, from, to, style, width = 1) ->
    c.strokeStyle = style
    c.lineWidth = width
    c.beginPath()
    c.moveTo(from.x, from.y)
    c.lineTo(to.x, to.y)
    c.stroke()

  window.path = []

  walls = []

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
      drawBox(context, p.x, p.y, GRID_RES, GRID_RES, "rgba(255, 0, 0, 0.4)")
    for point in walls
      p = gridToScreen(point)
      drawBox(context, p.x, p.y, GRID_RES, GRID_RES, "rgba(128, 128, 128, 0.2)")
    if window.nx && window.ny && window.gridMe && mode.match(/strafe/)
      if mode == "strafe-ccw"
        to = new Point(screenMe.x + nx * 100, screenMe.y + ny * 100)
      else if mode == "strafe-cw"
        to = new Point(screenMe.x - nx * 100, screenMe.y - ny * 100)
      drawLine(context, screenMe, to, "rgba(255, 0, 0, 0.5)", 2)
    if window.shootTarget && window.screenTarget
      drawLine(context, screenTarget, shootTarget, "green", 2)
      x = shootTarget.x - GRID_RES/ 4
      y = shootTarget.y - GRID_RES / 4
      drawBox(context, x, y, GRID_RES / 2, GRID_RES / 2, "rgba(0, 196, 0, 0.5)")
    if window.shootTarget && window.screenMe
      drawLine(context, screenMe, shootTarget, "rgba(0, 196, 0, 0.5)", 1)
    context.font = "48px Menlo"
    context.textAlign = "center"
    context.fillStyle = "rgba(128, 64, 64, 0.5)"
    context.fillText(mode, width / 2, 100)

  # http://cgafaq.info/wiki/Intersecting_line_segments_(2D)
  lineIntersects = (a, b, c, d) ->
    r = ((a.y - c.y) * (d.x - c.x) - (a.x - c.x) * (d.y - c.y)) /
      ((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x))
    s = ((a.y - c.y) * (b.x - a.x) - (a.x - c.x) * (b.y - a.y)) /
      ((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x))
    return (0 <= r && r <= 1) && (0 <= s && s <= 1)

  targetHistory = { id: null, point: null }

  count = 0
  targetLoop = ->
    count++

    window.me = Game.world.players.filter((p) -> p.you)[0]
    window.target = Game.world.players.
      filter((p) -> !p.you && !p.dead).
      sort((a, b) -> b.health - a.health).
      pop()

    window.screenMe = playerPoint(me)
    window.gridMe = screenToGrid(screenMe)

    if !target
      window.path = []
      return

    if !window.wallLines
      window.wallLines = Game.world.walls
      walls = []
      for line in wallLines
        if line.a.x == line.b.x # vertical
          for y in [line.a.y..line.b.y] by GRID_RES
            walls.push(new Point(Math.floor(line.a.x / GRID_RES), Math.floor(y / GRID_RES)))
        if line.a.y == line.b.y # horizontal
          for x in [line.a.x..line.b.x] by GRID_RES
            walls.push(new Point(Math.floor(x / GRID_RES), Math.floor(line.a.y / GRID_RES)))

    window.screenTarget = playerPoint(target)
    gridTarget = screenToGrid(screenTarget)

    dx = target.pos.x - me.pos.x
    dy = target.pos.y - me.pos.y
    distance = Math.sqrt(dx * dx + dy * dy)
    window.nx = -dy / distance
    window.ny = +dx / distance

    # Shoot!
    if count % 5 == 0
      scatterFactor = Math.max(0, distance - 50) / 4
      scatter = Math.random() * scatterFactor - (scatterFactor / 2)

      leadFactor = (Math.random() * distance * 0.02)

      if targetHistory.id == target.id
        st = screenTarget
        window.shootTarget = new Point(
          st.x + (st.x - targetHistory.point.x) * leadFactor,
          st.y + (st.y - targetHistory.point.y) * leadFactor
        )
      else
        window.shootTarget = screenTarget

      targetHistory = {id: target.id, point: screenTarget}

      # line of sight detection.
      window.lineOfSight = true
      for line in wallLines
        wallA = new Point(line.a.x, line.a.y)
        wallB = new Point(line.b.x, line.b.y)
        if lineIntersects(screenMe, shootTarget, wallA, wallB)
          window.mode = "seek"
          window.lineOfSight = false
          break

      if window.lineOfSight
        Game.ws.send JSON.stringify({type: "shoot", x: shootTarget.x, y: shootTarget.y})

    # Path-find and move!
    window.path = new AStar().search(gridMe, gridTarget, walls, 256)

    if path.length <= 1
      return
    if path.length < 8 && !mode.match(/strafe/)
      setMode(["strafe-cw", "strafe-ccw"][Math.floor(Math.random() * 2)])

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

  window.setInterval(targetLoop, 10)

(->
  script = document.createElement("script")
  script.addEventListener("load", begin)
  script.src = "http://paulbook.local:8000/js/point.js"
  document.body.appendChild(script)

  script = document.createElement("script")
  script.addEventListener("load", begin)
  script.src = "http://paulbook.local:8000/js/a_star.js"
  document.body.appendChild(script)
)()
