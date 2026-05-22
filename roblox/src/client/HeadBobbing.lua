--[[
    HeadBobbing.lua (Client Script)
    ==============================
    This script adds immersive handheld found-footage camera bobbing to Roblox.
    It calculates sways and vertical bobs dynamically using sine and cosine waves
    multiplied by current character movement velocities, creating a visceral first-person horror feel.
--]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- Tuning Variables
local BOB_FREQUENCY_WALK = 11
local BOB_FREQUENCY_RUN = 16
local BOB_AMPLITUDE_WALK = 0.08
local BOB_AMPLITUDE_RUN = 0.16

local bobTimer = 0

local function getCharacterData()
	local char = player.Character
	if char then
		local root = char:FindFirstChild("HumanoidRootPart")
		local hum = char:FindFirstChild("Humanoid")
		return root, hum
	end
	return nil, nil
end

-- Hook into RenderStepped camera update frames
RunService.RenderStepped:Connect(function(dt)
	local root, hum = getCharacterData()
	if not root or not hum then return end
	
	-- Verify if player is moving on floor
	local flatVelocity = Vector3.new(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z)
	local speed = flatVelocity.Magnitude
	
	if speed > 1.0 and hum.MoveDirection.Magnitude > 0 and hum.FloorMaterial ~= Enum.Material.Air then
		-- Determine if sprinting or walking
		local isSprinting = speed > 17
		local freq = isSprinting and BOB_FREQUENCY_RUN or BOB_FREQUENCY_WALK
		local amp = isSprinting and BOB_AMPLITUDE_RUN or BOB_AMPLITUDE_WALK
		
		bobTimer = bobTimer + dt * freq
		
		-- Sine wave for vertical bob, cosine for side-to-side camera roll
		local bobY = math.sin(bobTimer) * amp
		local bobX = math.cos(bobTimer * 0.5) * amp * 0.4
		local bobRoll = math.sin(bobTimer * 0.5) * amp * 1.5 -- subtle head tilt (degrees)
		
		-- Apply relative offsets to camera CFrame
		local originalCFrame = camera.CFrame
		local bobOffset = CFrame.new(bobX, bobY, 0) * CFrame.Angles(0, 0, math.rad(bobRoll))
		
		camera.CFrame = originalCFrame * bobOffset
	else
		-- Reset bob timer slowly when stationary
		bobTimer = 0
	end
end)
