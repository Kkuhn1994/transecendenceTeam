/**
 * Simplified AI Pong Opponent
 * Reacts when ball crosses middle, predicts impact point, moves toward it
 */

class PongAI {
  constructor() {
    this.targetY = 0;
    this.isTracking = false;
    this.lastBallX = 0;
    this.cachedPrediction = null; // Cache prediction to avoid recalculating
  }

  /**
   * Paddle Position calculation
   */
  update(gameState) {
    const {
      ballX,
      ballY, 
      ballSpeedX,
      ballSpeedY,
      rightPaddleY,
      canvasWidth,
      canvasHeight,
      paddleHeight
    } = gameState;

    // When does the paddle move
    const ballPastMiddle = ballX > canvasWidth / 2;
    const ballComingToward = ballSpeedX > 0;
    
    if (ballPastMiddle && ballComingToward) {
      // Only recalculate if ball position changed significantly
      if (!this.cachedPrediction || Math.abs(ballX - this.lastBallX) > 10) {
        this.isTracking = true;
        this.targetY = this.predictImpactPoint(gameState);
        this.cachedPrediction = this.targetY;
        this.lastBallX = ballX;
      } else {
        // Use cached prediction
        this.targetY = this.cachedPrediction;
      }
    } else if (!ballComingToward) {
      this.isTracking = false;
      this.cachedPrediction = null;
      // Return to center when ball goes away
      // this.targetY = (canvasHeight / 2) - (paddleHeight / 2);
    }

    return this.targetY;
  }

  /**
   * Predict where ball will hit the paddle area
   */
  predictImpactPoint(gameState) {
    const {
      ballX,
      ballY,
      ballSpeedX,
      ballSpeedY,
      canvasWidth,
      canvasHeight,
      paddleHeight,
      paddleWidth
    } = gameState;

    // Calculate time until ball reaches paddle
    const paddleX = canvasWidth - paddleWidth;
    const timeToReach = (paddleX - ballX) / ballSpeedX;
    
    // Predict ball Y position with wall bounces
    let predictedY = ballY + (ballSpeedY * timeToReach);
    
    // Handle wall bounces
    while (predictedY < 0 || predictedY > canvasHeight) {
      if (predictedY < 0) {
        predictedY = Math.abs(predictedY);
      }
      if (predictedY > canvasHeight) {
        predictedY = 2 * canvasHeight - predictedY;
      }
    }
    
    // Return target position for paddle center
    return predictedY - paddleHeight / 2;
  }

  /**
   * Check if AI should move up, down, or stay
   */
  shouldMoveUp(currentPaddleY, paddleHeight) {
    if (!this.isTracking) return false;
    
    const currentCenter = currentPaddleY + paddleHeight / 2;
    const targetCenter = this.targetY + paddleHeight / 2;
    
    return targetCenter < currentCenter - 2; // 2px dead zone
  }

  shouldMoveDown(currentPaddleY, paddleHeight) {
    if (!this.isTracking) return false;
    
    const currentCenter = currentPaddleY + paddleHeight / 2;
    const targetCenter = this.targetY + paddleHeight / 2;
    
    return targetCenter > currentCenter + 2; // 2px dead zone
  }
}

module.exports = {
  PongAI
};