--[[
    FlashlightClient.lua (Client Script)
    ===================================
    This script implements the dynamic shadow-casting Flashlight system in Roblox.
    It binds the 'F' key, dynamically instantiates a Spotlight onto the camera,
    manages battery levels, and generates realistic flickering patterns when battery drops.
--]]

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- Tuning Variables
local FLASHLIGHT_KEY = Enum.KeyCode.F
local BATTERY_DRAIN_RATE = 1.6 -- battery drain per second (lasts ~60s)
local RECOVERY_RATE = 3.0 -- charges when turned off

local battery = 100
local maxBattery = 100
local flashlightOn = false

-- SpotLight configuration
local spotLight = Instance.new("SpotLight")
spotLight.Color = Color3.fromRGB(255, 254, 220) -- warm white
spotLight.Brightness = 4.5
spotLight.Range = 35
spotLight.Angle = 26
spotLight.Shadows = true -- dynamic shadow-casting
spotLight.Enabled = false

-- Sound effects
local clickSound = Instance.new("Sound")
clickSound.SoundId = "rbxassetid://4138258356" -- Flashlight switch click (example asset)
clickSound.Volume = 0.8
clickSound.Parent = camera

local function getPlayerHead()
	local char = player.Character
	return char and char:WaitForChild("Head", 3)
end

-- Toggle Flashlight state
local function toggleFlashlight()
	if battery <= 0 then return end
	
	clickSound:Play()
	flashlightOn = not flashlightOn
	spotLight.Enabled = flashlightOn
end

-- Attach flashlight to head and update battery drain frames
RunService.RenderStepped:Connect(function(dt)
	local head = getPlayerHead()
	if not head then return end
	
	-- Attach spotlight securely to camera perspective
	spotLight.Parent = head
	spotLight.Face = Enum.NormalId.Front
	
	-- Battery management loop
	if flashlightOn then
		battery = math.max(0, battery - (BATTERY_DRAIN_RATE * dt))
		
		-- Low-battery flickering indicators
		if battery < 20 then
			local flickerRoll = math.random()
			if flickerRoll > 0.75 then
				spotLight.Brightness = math.random() * 2.0 -- flicker
			else
				spotLight.Brightness = 4.5 -- restore
			end
		end
		
		if battery <= 0 then
			flashlightOn = false
			spotLight.Enabled = false
			clickSound:Play() -- dying click
		end
	else
		-- Slow charge recovery if powered down
		battery = math.min(maxBattery, battery + (RECOVERY_RATE * dt))
	end
	
	-- Update HUD Bar if it exists in PlayerGui
	local playerGui = player:WaitForChild("PlayerGui", 2)
	if playerGui then
		local hud = playerGui:FindFirstChild("GameHUD")
		if hud then
			local bar = hud:FindFirstChild("BatteryBar", true)
			if bar then
				bar.Size = UDim2.new(battery / maxBattery, 0, 1, 0)
				-- Shift color to red on low charge
				if battery < 20 then
					bar.BackgroundColor3 = Color3.fromRGB(239, 68, 68) -- Red
				elseif battery < 50 then
					bar.BackgroundColor3 = Color3.fromRGB(234, 179, 8) -- Yellow
				else
					bar.BackgroundColor3 = Color3.fromRGB(34, 197, 94) -- Green
				end
			end
		end
	end
end)

-- Bind keyboard/gamepad triggers
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	if input.KeyCode == FLASHLIGHT_KEY then
		toggleFlashlight()
	end
end)
