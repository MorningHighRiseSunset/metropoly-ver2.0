export default async function run(page, ui) {
  // Set viewport to mobile size (iPhone SE)
  await page.setViewportSize({ width: 375, height: 667 });

  // Reload to trigger mobile detection
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(msg.text());
  });

  // Check if mobile mode is active
  const isMobile = await page.evaluate(() => window.isMobileView);
  const cameraFollowMode = await page.evaluate(() => window.cameraFollowMode);

  // Get initial camera position
  const initialCamera = await page.evaluate(() => ({
    x: window.threeCamera?.position?.x,
    y: window.threeCamera?.position?.y,
    z: window.threeCamera?.position?.z
  }));

  // Roll dice
  await page.locator('#rollDiceBtn').click();
  await page.waitForTimeout(1000);

  // Check camera position during roll
  const cameraDuringRoll = await page.evaluate(() => ({
    x: window.threeCamera?.position?.x,
    y: window.threeCamera?.position?.y,
    z: window.threeCamera?.position?.z,
    isRolling: window.isRolling,
    savedCameraPos: window.savedCameraPosition
  }));

  await page.waitForTimeout(3000);

  // Check camera position after roll
  const cameraAfterRoll = await page.evaluate(() => ({
    x: window.threeCamera?.position?.x,
    y: window.threeCamera?.position?.y,
    z: window.threeCamera?.position?.z,
    isRolling: window.isRolling
  }));

  return {
    isMobile,
    cameraFollowMode,
    initialCamera,
    cameraDuringRoll,
    cameraAfterRoll,
    consoleLogs: consoleLogs.filter(log => log.includes('dice') || log.includes('camera') || log.includes('roll') || log.includes('Starting'))
  };
}
