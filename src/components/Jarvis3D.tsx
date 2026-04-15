import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Float, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'motion/react';

function NeuralSphere({ isListening, isThinking, isSpeaking }: { isListening: boolean; isThinking: boolean; isSpeaking: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 4000;
  
  const [positions, initialPositions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const initial = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      
      initial[i * 3] = x;
      initial[i * 3 + 1] = y;
      initial[i * 3 + 2] = z;
    }
    return [pos, initial];
  }, []);

  useFrame(() => {
    const t = performance.now() / 1000;
    if (pointsRef.current) {
      const positionsAttr = pointsRef.current.geometry.attributes.position;
      
      // Expansion factor
      let expansion = 1.0;
      if (isSpeaking) expansion = 1.5 + Math.sin(t * 10) * 0.1;
      else if (isListening) expansion = 1.1 + Math.sin(t * 5) * 0.05;
      else if (isThinking) expansion = 1.2 + Math.sin(t * 15) * 0.05;

      for (let i = 0; i < count; i++) {
        const x = initialPositions[i * 3];
        const y = initialPositions[i * 3 + 1];
        const z = initialPositions[i * 3 + 2];
        
        // Add some noise/vibration
        const noise = Math.sin(t * 2 + i) * 0.02;
        
        positionsAttr.setXYZ(
          i,
          x * expansion + noise,
          y * expansion + noise,
          z * expansion + noise
        );
      }
      positionsAttr.needsUpdate = true;
      
      pointsRef.current.rotation.y = t * 0.1;
      pointsRef.current.rotation.x = t * 0.05;
    }
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#00d4ff"
        size={0.015}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function OrbitingLights() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      const t = performance.now() / 1000;
      groupRef.current.rotation.y = t * 0.5;
      groupRef.current.rotation.z = t * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight position={[3, 0, 0]} intensity={2} color="#00ffff" />
      <pointLight position={[-3, 0, 0]} intensity={2} color="#0066ff" />
      <pointLight position={[0, 3, 0]} intensity={2} color="#ffffff" />
    </group>
  );
}

export function Jarvis3D({ isListening, isThinking, isSpeaking }: { isListening: boolean; isThinking: boolean; isSpeaking: boolean }) {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.1} />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <NeuralSphere isListening={isListening} isThinking={isThinking} isSpeaking={isSpeaking} />
          <OrbitingLights />
        </Float>

        {/* Deep space glow */}
        <Sphere args={[15, 32, 32]}>
          <meshBasicMaterial color="#000810" side={THREE.BackSide} />
        </Sphere>
      </Canvas>
      
      {/* HUD Rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: isSpeaking ? 1.4 : isListening ? 1.1 : 1,
            opacity: isSpeaking ? 0.6 : 0.2
          }}
          transition={{ 
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { type: "spring", stiffness: 100 }
          }}
          className="w-96 h-96 border border-hud-accent/20 rounded-full" 
        />
        <motion.div 
          animate={{ 
            rotate: -360,
            scale: isSpeaking ? 1.5 : isListening ? 1.2 : 1,
            opacity: isSpeaking ? 0.4 : 0.1
          }}
          transition={{ 
            rotate: { duration: 30, repeat: Infinity, ease: "linear" },
            scale: { type: "spring", stiffness: 80 }
          }}
          className="absolute w-[450px] h-[450px] border border-hud-accent/10 rounded-full" 
        />
      </div>
    </div>
  );
}
