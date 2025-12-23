
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isModelTalking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, isModelTalking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bars = 20;
    const barWidth = 4;
    const barGap = 4;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < bars; i++) {
        const height = isActive 
          ? (isModelTalking ? Math.random() * 40 + 10 : Math.random() * 10 + 5)
          : 2;
        
        const x = (i * (barWidth + barGap)) + (canvas.width - (bars * (barWidth + barGap))) / 2;
        const y = (canvas.height - height) / 2;
        
        ctx.fillStyle = isModelTalking ? '#a855f7' : '#6366f1';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 2);
        ctx.fill();
      }
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, isModelTalking]);

  return (
    <div className="flex justify-center items-center h-20 w-full bg-slate-900/50 rounded-xl mb-4">
      <canvas ref={canvasRef} width={200} height={60} />
    </div>
  );
};
