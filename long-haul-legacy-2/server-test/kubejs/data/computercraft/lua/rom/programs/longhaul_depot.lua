-- Long Haul Legacy: warehouse stock alarm, NOT a production-rate meter.
-- Usage: longhaul_depot <inventory peripheral> <item id> <minimum> [redstone side]
-- Example: longhaul_depot back create:iron_sheet 64 right
local args = { ... }
if #args < 3 then
  print("Usage: longhaul_depot <inventory> <item> <minimum> [output]")
  print("Example: longhaul_depot back create:iron_sheet 64 right")
  return
end
local name, item, minimum, output = args[1], args[2], tonumber(args[3]), args[4]
if not minimum or minimum < 0 or minimum ~= math.floor(minimum) then
  error("minimum must be a non-negative integer", 0)
end
if output then
  local valid = false
  for _, side in ipairs(redstone.getSides()) do if side == output then valid = true end end
  if not valid then error("invalid redstone output side", 0) end
end
local function run()
  while true do
    local inv = peripheral.wrap(name)
    term.clear(); term.setCursorPos(1, 1)
    print("LONG HAUL / DEPOT WATCH")
    print("Inventory: " .. name)
    print("Item: " .. item)
    if inv and type(inv.list) == "function" then
      local total = 0
      for _, stack in pairs(inv.list()) do
        if stack.name == item then total = total + stack.count end
      end
      print("Stock: " .. total .. " / threshold " .. minimum)
      print(total < minimum and "RESTOCK REQUESTED" or "STOCK OK")
      if output then redstone.setOutput(output, total < minimum) end
    else
      print("INVENTORY OFFLINE")
      -- Fail visibly: request supplies if the configured inventory disappears.
      if output then redstone.setOutput(output, true) end
    end
    print("Measures stock, not production.")
    print("Ctrl+T to stop.")
    sleep(2)
  end
end
local ok, err = pcall(run)
if output then redstone.setOutput(output, false) end
if not ok and err ~= "Terminated" then printError(err) end
