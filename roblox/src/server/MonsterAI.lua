--[[
    MonsterAI.lua (Server Script)
    ============================
    This script controls the Backrooms creature NPC on Roblox.
    It uses PathfindingService to calculate routes through dark office corridors,
    performs raycasting for line-of-sight checks, and dynamically triggers
    agressive hunts when player footsteps are heard or seen.
--]]

local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")

local creature = script.Parent
local humanoid = creature:WaitForChild("Humanoid")
local rootPart = creature:WaitForChild("HumanoidRootPart")

-- Tuning parameters
local WANDER_SPEED = 8
local CHASE_SPEED = 18
local DETECTION_DIST = 75 -- max detection distance (meters)
local SIGHT_DIST = 45 -- line of sight chase trigger distance

local wanderTarget = nil
local activeState = "WANDER" -- States: WANDER, CHASE, STALK

-- Create a sound effects emitter
local soundEmitter = Instance.new("Sound")
soundEmitter.SoundId = "rbxassetid://9069609268" -- Scary monster breathing (example asset)
soundEmitter.Volume = 1.0
soundEmitter.Looped = true
soundEmitter.Parent = rootPart
soundEmitter:Play()

local screechSound = Instance.new("Sound")
screechSound.SoundId = "rbxassetid://556133989" -- Screamer screech (example asset)
screechSound.Volume = 1.5
screechSound.Parent = rootPart

-- Find the nearest player character in workspace
local function getNearestPlayer()
	local nearestChar = nil
	local minDist = DETECTION_DIST
	
	for _, player in ipairs(Players:GetPlayers()) do
		local char = player.Character
		if char and char:FindFirstChild("HumanoidRootPart") and char:FindFirstChild("Humanoid") then
			if char.Humanoid.Health > 0 then
				local dist = (char.HumanoidRootPart.Position - rootPart.Position).Magnitude
				if dist < minDist then
					minDist = dist
					nearestChar = char
				end
			end
		end
	end
	
	return nearestChar, minDist
end

-- Checks if there are any obstacles (walls) blocking the creature's line of sight to the target
local function checkLineOfSight(targetChar)
	local origin = rootPart.Position + Vector3.new(0, 2, 0) -- height adjusted
	local target = targetChar.HumanoidRootPart.Position
	local direction = target - origin
	
	if direction.Magnitude > SIGHT_DIST then
		return false
	end
	
	local raycastParams = RaycastParams.new()
	raycastParams.FilterDescendantsInstances = {creature}
	raycastParams.FilterType = Enum.RaycastFilterType.Exclude
	
	local rayResult = workspace:Raycast(origin, direction, raycastParams)
	
	if rayResult then
		-- If the ray hit the player's character, we have line of sight!
		return rayResult.Instance:IsDescendantOf(targetChar)
	end
	return false
end

-- Generates a random coordinate to wander around
local function chooseWanderTarget()
	local offsetRange = 30
	local rx = rootPart.Position.X + math.random(-offsetRange, offsetRange)
	local rz = rootPart.Position.Z + math.random(-offsetRange, offsetRange)
	wanderTarget = Vector3.new(rx, rootPart.Position.Y, rz)
end

-- Paths towards a vector target using Roblox's PathfindingService
local function pathfindTo(targetPos)
	local path = PathfindingService:CreatePath({
		AgentRadius = 3,
		AgentHeight = 6,
		AgentCanJump = false
	})
	
	local success, errorMessage = pcall(function()
		path:ComputeAsync(rootPart.Position, targetPos)
	end)
	
	if success and path.Status == Enum.PathStatus.Success then
		local waypoints = path:GetWaypoints()
		
		-- Move humanoid to the second waypoint (avoiding lag stutter)
		if #waypoints > 1 then
			humanoid:MoveTo(waypoints[2].Position)
		end
	else
		-- Fallback to direct walk if pathfinding service fails
		humanoid:MoveTo(targetPos)
	end
end

-- Main AI Loop running every 0.15 seconds
task.spawn(function()
	while true do
		task.wait(0.15)
		
		local target, dist = getNearestPlayer()
		
		if target then
			local hasSight = checkLineOfSight(target)
			local playerSprint = target.Humanoid.WalkSpeed > 16 -- Is sprinting
			
			if hasSight or (playerSprint and dist < 35) then
				-- Alert screech when starting hunt
				if activeState ~= "CHASE" then
					screechSound:Play()
				end
				
				activeState = "CHASE"
				humanoid.WalkSpeed = CHASE_SPEED
				soundEmitter.PlaybackSpeed = 1.3 -- breathing speeds up
				
				-- Chase player directly
				pathfindTo(target.HumanoidRootPart.Position)
			else
				-- Player is close but hidden: creep stalker mode
				activeState = "STALK"
				humanoid.WalkSpeed = WANDER_SPEED
				soundEmitter.PlaybackSpeed = 0.95
				
				pathfindTo(target.HumanoidRootPart.Position)
			end
		else
			-- No players nearby: Wander around randomly
			activeState = "WANDER"
			humanoid.WalkSpeed = WANDER_SPEED - 2
			soundEmitter.PlaybackSpeed = 0.8
			
			if not wanderTarget or (rootPart.Position - wanderTarget).Magnitude < 4 then
				chooseWanderTarget()
			end
			
			if wanderTarget then
				pathfindTo(wanderTarget)
			end
		end
	end
end)

-- Check jumpscare trigger on contact
rootPart.Touched:Connect(function(otherPart)
	local model = otherPart.Parent
	if model and model:FindFirstChild("Humanoid") and model:FindFirstChildOfClass("Player") then
		local hum = model:FindFirstChild("Humanoid")
		if hum.Health > 0 then
			hum.Health = 0 -- Eliminate player
			screechSound:Play()
		end
	end
end)
