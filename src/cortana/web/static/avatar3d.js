import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import "./emotion-animation.js";
import "./facial-intelligence.js";
import "./unreal-bridge.js";

(() => {
  "use strict";
  const wrapper = document.getElementById("avatar");
  const mount = document.getElementById("avatar3d");
  if (!wrapper || !mount) return;

  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.35, 8.8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    mount.appendChild(renderer.domElement);
    wrapper.classList.add("three-active");

    scene.add(new THREE.HemisphereLight(0x9defff, 0x071b40, 2.3));
    const keyLight = new THREE.DirectionalLight(0xb8f9ff, 3.2);
    keyLight.position.set(-3, 4, 6);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x247cff, 9, 15);
    rimLight.position.set(2, 0.4, -2);
    scene.add(rimLight);
    const faceLight = new THREE.PointLight(0x76f4ff, 4.5, 8);
    faceLight.position.set(0, 1.1, 3);
    scene.add(faceLight);

    const root = new THREE.Group();
    root.position.y = -0.12;
    scene.add(root);
    const cyan = new THREE.Color(0x78efff);
    const hairColor = new THREE.Color(0x3ca9ed);
    const skinMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8bdffb, metalness: 0.2, roughness: 0.24,
      transparent: true, opacity: 0.86, clearcoat: 0.8, clearcoatRoughness: 0.16,
      emissive: 0x0b3858, emissiveIntensity: 0.55
    });
    const hairMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x45b9ef, metalness: 0.35, roughness: 0.19,
      transparent: true, opacity: 0.94, clearcoat: 1, emissive: 0x0b5d9a, emissiveIntensity: 0.7
    });
    const shellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6ae9ff, metalness: 0.48, roughness: 0.2, transparent: true, opacity: 0.28,
      emissive: 0x0b90bf, emissiveIntensity: 0.9, wireframe: true
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x04213c, metalness: 0.28, roughness: 0.3,
      emissive: 0x075a85, emissiveIntensity: 0.7
    });
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4ffff, emissive: 0x65f0ff, emissiveIntensity: 2.5, roughness: 0.16
    });
    const irisMaterial = new THREE.MeshStandardMaterial({
      color: 0x1aa9f4, emissive: 0x23d7ff, emissiveIntensity: 2.4, metalness: 0.2, roughness: 0.13
    });

    function ellipsoid(parent, material, position, scale, segments = 32) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(16, segments - 8)), material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.scale.set(scale[0], scale[1], scale[2]);
      parent.add(mesh);
      return mesh;
    }
    function tube(parent, points, radius, material) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 8, false), material);
      parent.add(mesh);
      return mesh;
    }
    const torso = ellipsoid(root, skinMaterial, [0, -1.25, -0.02], [1.38, 0.78, 0.54]);
    ellipsoid(root, hairMaterial, [0, -1.35, -0.15], [1.22, 0.65, 0.57]);

    // Lightweight procedural arm rigs: shoulder, forearm and hand remain parented
    // to the torso root, so they work without a downloaded skeletal model.
    function createArm(side) {
      const rig = new THREE.Group();
      rig.position.set(side * 1.02, -0.82, 0.02);
      root.add(rig);
      ellipsoid(rig, skinMaterial, [side * 0.04, -0.28, 0], [0.2, 0.42, 0.2], 24);
      ellipsoid(rig, hairMaterial, [side * 0.06, -0.7, 0.035], [0.15, 0.34, 0.16], 24);
      ellipsoid(rig, skinMaterial, [side * 0.07, -1.02, 0.08], [0.17, 0.19, 0.14], 20);
      for (let finger = 0; finger < 3; finger += 1) {
        ellipsoid(rig, skinMaterial, [side * (0.02 + finger * 0.07), -1.18, 0.1], [0.035, 0.1, 0.04], 12);
      }
      return rig;
    }
    const leftArm = createArm(-1);
    const rightArm = createArm(1);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.31, 0.76, 24), skinMaterial);
    neck.position.set(0, -0.48, 0.01);
    root.add(neck);

    const headRig = new THREE.Group();
    headRig.position.set(0, 0.55, 0.05);
    root.add(headRig);
    ellipsoid(headRig, skinMaterial, [0, 0, 0], [0.78, 1.02, 0.58], 48);
    ellipsoid(headRig, shellMaterial, [0, 0.03, -0.03], [0.82, 1.07, 0.61], 38);
    ellipsoid(headRig, hairMaterial, [0, 0.65, -0.13], [0.88, 0.67, 0.62], 40);
    ellipsoid(headRig, hairMaterial, [-0.52, 0.25, -0.03], [0.3, 0.78, 0.53], 32);
    ellipsoid(headRig, hairMaterial, [0.58, 0.2, -0.05], [0.25, 0.84, 0.49], 32);
    ellipsoid(headRig, hairMaterial, [-0.26, 0.95, 0.28], [0.48, 0.2, 0.24], 28);
    tube(headRig, [[-0.6, 0.9, 0.15], [-0.35, 1.22, 0.26], [0.05, 1.3, 0.2], [0.4, 1.08, 0.22]], 0.055, eyeMaterial);
    tube(headRig, [[-0.57, 0.63, 0.42], [-0.48, 0.25, 0.48], [-0.4, -0.15, 0.43]], 0.045, eyeMaterial);
    tube(headRig, [[0.56, 0.65, 0.39], [0.52, 0.18, 0.46], [0.44, -0.14, 0.41]], 0.035, eyeMaterial);

    const eyeLeft = ellipsoid(headRig, eyeMaterial, [-0.31, 0.1, 0.49], [0.17, 0.09, 0.055], 24);
    const eyeRight = ellipsoid(headRig, eyeMaterial, [0.31, 0.1, 0.49], [0.17, 0.09, 0.055], 24);
    const browLeft = ellipsoid(headRig, hairMaterial, [-0.31, 0.29, 0.48], [0.19, 0.038, 0.045], 20);
    const browRight = ellipsoid(headRig, hairMaterial, [0.31, 0.29, 0.48], [0.19, 0.038, 0.045], 20);
    const cheekLeft = ellipsoid(headRig, eyeMaterial, [-0.47, -0.19, 0.43], [0.105, 0.045, 0.025], 20);
    const cheekRight = ellipsoid(headRig, eyeMaterial, [0.47, -0.19, 0.43], [0.105, 0.045, 0.025], 20);
    ellipsoid(headRig, irisMaterial, [-0.31, 0.1, 0.54], [0.067, 0.066, 0.035], 24);
    ellipsoid(headRig, irisMaterial, [0.31, 0.1, 0.54], [0.067, 0.066, 0.035], 24);
    ellipsoid(headRig, darkMaterial, [0, -0.06, 0.55], [0.035, 0.18, 0.045], 16);
    const mouth = ellipsoid(headRig, darkMaterial, [0, -0.38, 0.5], [0.14, 0.03, 0.035], 24);
    const lipHighlight = tube(headRig, [[-0.16, -0.38, 0.53], [-0.08, -0.36, 0.54], [0, -0.38, 0.55], [0.08, -0.36, 0.54], [0.16, -0.38, 0.53]], 0.012, eyeMaterial);

    ellipsoid(headRig, hairMaterial, [-0.79, -0.03, 0.03], [0.13, 0.23, 0.15], 20);
    ellipsoid(headRig, hairMaterial, [0.79, -0.03, 0.03], [0.13, 0.23, 0.15], 20);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x57dcff, emissive: 0x0b93ff, emissiveIntensity: 1.6,
      transparent: true, opacity: 0.46, metalness: 0.6, roughness: 0.23
    });
    const orbitA = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.012, 8, 120), ringMaterial);
    orbitA.rotation.x = Math.PI * 0.43;
    orbitA.position.y = 0.12;
    root.add(orbitA);
    const orbitB = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.009, 8, 120), ringMaterial.clone());
    orbitB.material.opacity = 0.25;
    orbitB.rotation.set(1.05, 0.32, -0.56);
    root.add(orbitB);
    const orbitC = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.008, 8, 100), ringMaterial.clone());
    orbitC.material.opacity = 0.34;
    orbitC.rotation.set(0.7, 1.05, 0.4);
    root.add(orbitC);

    const particleCount = 140;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 4.1;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0x7beeff, size: 0.025, transparent: true, opacity: 0.74, sizeAttenuation: true })
    );
    root.add(particles);

    const emotionEngine = window.CortanaEmotionAnimation.createEmotionAnimationEngine({ transitionSeconds: 0.42 });
    const facialEngine = window.CortanaFacialIntelligence.createFacialIntelligence();
    let previousFrameTime = null;
    let currentEmotionProfile = emotionEngine.update(0);
    window.addEventListener("cortana:emotion-transition", (event) => {
      const detail = event && event.detail;
      emotionEngine.setEmotion(detail && detail.emotion);
    });
    let lastState = "idle";
    let activeViseme = "neutral";
    let sequencedGesture = { armLift: 0, armOpen: 0, wristTurn: 0, intensity: 0 };
    window.addEventListener("cortana:gesture-frame", (event) => {
      const detail = event && event.detail;
      if (!detail) return;
      const values = ["armLift", "armOpen", "wristTurn", "intensity"];
      if (values.every((key) => Number.isFinite(detail[key]))) {
        sequencedGesture = {
          armLift: THREE.MathUtils.clamp(detail.armLift, -0.6, 0.8),
          armOpen: THREE.MathUtils.clamp(detail.armOpen, -0.6, 0.8),
          wristTurn: THREE.MathUtils.clamp(detail.wristTurn, -0.5, 0.5),
          intensity: THREE.MathUtils.clamp(detail.intensity, 0, 1)
        };
      }
    });
    window.addEventListener("cortana:viseme", (event) => {
      const name = event && event.detail && event.detail.viseme;
      if (["neutral", "open", "mid", "wide", "round", "closed", "teeth"].includes(name)) {
        activeViseme = name;
      }
    });
    let nextBlinkAt = 1.7 + Math.random() * 1.8;
    let blinkStartedAt = -1;
    const clock = new THREE.Clock();
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.position.z = width < 400 ? 9.4 : 8.8;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    if (window.ResizeObserver) new ResizeObserver(resize).observe(mount);
    window.addEventListener("resize", resize);
    resize();

    function blendFactor(deltaSeconds, timeConstant) {
      return 1 - Math.exp(-Math.LN2 * Math.max(0, deltaSeconds) / timeConstant);
    }

    function animate() {
      const elapsed = clock.getElapsedTime();
      const nowMs = performance.now();
      const deltaSeconds = previousFrameTime === null ? 0 : Math.min(0.1, Math.max(0, (nowMs - previousFrameTime) / 1000));
      previousFrameTime = nowMs;
      const requestedEmotion = wrapper.dataset.emotion || "calm";
      if (requestedEmotion !== emotionEngine.getEmotion()) emotionEngine.setEmotion(requestedEmotion);
      const state = wrapper.dataset.state || "idle";
      const speaking = state === "speaking";
      const listening = state === "listening";
      const voiceLevel = Math.max(0, Math.min(1, Number(wrapper.dataset.mouthOpen || "0")));
      emotionEngine.setVoiceActivity(voiceLevel, speaking);
      currentEmotionProfile = emotionEngine.update(deltaSeconds);
      root.position.y = -0.12 + Math.sin(elapsed * 0.8) * 0.035;
      root.rotation.y = Math.sin(elapsed * 0.38) * 0.05;
      headRig.rotation.y = Math.sin(elapsed * 0.68) * 0.065;
      const emotionProfile = currentEmotionProfile;
      const facial = facialEngine.update({
        deltaSeconds, emotion: emotionProfile.emotion, viseme: activeViseme,
        speaking, audioLevel: voiceLevel
      });
      if (window.CortanaUnrealBridgeRuntime) {
        window.CortanaUnrealBridgeRuntime.publish({
          timestampMs: nowMs, state, emotion: emotionProfile.emotion,
          viseme: activeViseme, audioLevel: voiceLevel, facial
        });
      }
      headRig.rotation.x = Math.sin(elapsed * 0.57) * 0.02 + emotionProfile.headPitch;
      headRig.rotation.z = Math.sin(elapsed * 0.42) * 0.008 + emotionProfile.headTilt;
      root.rotation.z = Math.sin(elapsed * 0.62) * emotionProfile.bodySway;
      torso.scale.y = 0.78 * (1 + Math.sin(elapsed * 1.65) * emotionProfile.breath);
      // Voice amplitude adds a restrained conversational gesture; emotion supplies
      // the baseline pose. The envelopes are smooth and bounded to avoid abrupt snaps.
      const voicePulse = speaking ? emotionProfile.voiceActivity * 0.22 : 0;
      const gestureWave = Math.sin(elapsed * (speaking ? 3.1 : 0.75));
      const armLift = emotionProfile.armLift + voicePulse * (0.65 + 0.35 * gestureWave) + sequencedGesture.armLift;
      const armOpen = emotionProfile.armOpen + voicePulse * 0.32 + sequencedGesture.armOpen;
      leftArm.rotation.z += ((armLift + armOpen + Math.sin(elapsed * 1.3) * emotionProfile.gesturePulse * 0.15) - leftArm.rotation.z) * blendFactor(deltaSeconds, 0.16);
      rightArm.rotation.z += ((-armLift - armOpen + Math.sin(elapsed * 1.3 + 0.6) * emotionProfile.gesturePulse * 0.15) - rightArm.rotation.z) * blendFactor(deltaSeconds, 0.16);
      leftArm.rotation.x += ((emotionProfile.wristTurn + voicePulse * 0.12 + sequencedGesture.wristTurn) - leftArm.rotation.x) * blendFactor(deltaSeconds, 0.18);
      rightArm.rotation.x += ((-emotionProfile.wristTurn - voicePulse * 0.12 - sequencedGesture.wristTurn * sequenceBlend) - rightArm.rotation.x) * blendFactor(deltaSeconds, 0.18);
      ringMaterial.color.setHex(emotionProfile.color);
      orbitB.material.color.setHex(emotionProfile.color);
      orbitC.material.color.setHex(emotionProfile.color);
      faceLight.color.setHex(emotionProfile.color);
      rimLight.color.setHex(emotionProfile.color);
      irisMaterial.emissive.setHex(emotionProfile.color);
      orbitA.rotation.z = elapsed * 0.1;
      orbitB.rotation.y = 0.32 + elapsed * 0.075;
      orbitC.rotation.z = 0.4 - elapsed * 0.06;
      particles.rotation.y = elapsed * 0.035;

      // Use measured output-audio energy when WebRTC is active; otherwise keep a subtle demo motion.
      const liveAudioDriven = wrapper.dataset.liveAudio === "true";
      const measuredMouth = Math.max(0, Math.min(1, Number(wrapper.dataset.mouthOpen || "0")));
      const demoMouth = speaking ? 0.12 + Math.abs(Math.sin(elapsed * 12.5)) * 0.45 : 0;
      const mouthDrive = liveAudioDriven ? measuredMouth : demoMouth;
      const visemeProfiles = {
        neutral: [0.14, 0.025, -0.38],
        open: [0.115, 0.095, -0.397],
        mid: [0.132, 0.061, -0.389],
        wide: [0.17, 0.034, -0.38],
        round: [0.078, 0.078, -0.394],
        closed: [0.12, 0.009, -0.383],
        teeth: [0.145, 0.029, -0.384]
      };
      const visemeProfile = visemeProfiles[activeViseme] || visemeProfiles.neutral;
      const audioBoost = liveAudioDriven ? mouthDrive * (activeViseme === "closed" ? 0.006 : 0.022) : 0;
      const blend = 1 - Math.exp(-Math.LN2 * Math.max(deltaSeconds, 0) / 0.07);
      const expressionWidth = 1 + facial.mouthWide * 0.58 + facial.mouthSmile * 0.3 - facial.mouthPucker * 0.46;
      const expressionOpening = facial.jawOpen * 0.038 + facial.lowerLipDepress * 0.012;
      const targetMouthX = (speaking ? visemeProfile[0] : emotionProfile.mouthX) * expressionWidth;
      const targetMouthY = (speaking ? visemeProfile[1] + audioBoost : emotionProfile.mouthY) + expressionOpening;
      const targetMouthYPos = (speaking ? visemeProfile[2] : emotionProfile.mouthYPos) - facial.jawOpen * 0.012;
      mouth.scale.x += (targetMouthX - mouth.scale.x) * blend;
      mouth.scale.y += (targetMouthY - mouth.scale.y) * blend;
      mouth.position.y += (targetMouthYPos - mouth.position.y) * blend;
      lipHighlight.scale.x += ((activeViseme === "wide" ? 1.14 : activeViseme === "round" ? 0.64 : 1) * (1 + facial.mouthSmile * 0.2) - lipHighlight.scale.x) * blend;
      const browLift = facial.browInnerUp * 0.075 - facial.browDown * 0.055;
      browLeft.position.y += ((0.29 + browLift) - browLeft.position.y) * blend;
      browRight.position.y += ((0.29 + browLift) - browRight.position.y) * blend;
      browLeft.rotation.z += ((facial.browDown * 0.16 - facial.browInnerUp * 0.08) - browLeft.rotation.z) * blend;
      browRight.rotation.z += ((-facial.browDown * 0.16 + facial.browInnerUp * 0.08) - browRight.rotation.z) * blend;
      const cheekScale = 1 + facial.cheekRaise * 0.38;
      cheekLeft.scale.y += ((0.045 * cheekScale) - cheekLeft.scale.y) * blend;
      cheekRight.scale.y += ((0.045 * cheekScale) - cheekRight.scale.y) * blend;
      cheekLeft.material.opacity = 0.42 + facial.cheekRaise * 0.42;
      cheekRight.material.opacity = 0.42 + facial.cheekRaise * 0.42;

      // Procedural blink with a short close/open envelope; restore eye scale after each blink.
      if (elapsed >= nextBlinkAt) {
        blinkStartedAt = elapsed;
        nextBlinkAt = elapsed + 2.8 + Math.random() * 3.8;
      }
      const blinkElapsed = blinkStartedAt < 0 ? 1 : elapsed - blinkStartedAt;
      const blink = blinkElapsed >= 0 && blinkElapsed < 0.17
        ? Math.sin((blinkElapsed / 0.17) * Math.PI)
        : 0;
      const eyeExpression = Math.max(0.55, Math.min(1.7, 1 + facial.eyeWide * 0.62 - facial.eyeSquint * 0.58));
      eyeLeft.scale.x = emotionProfile.eyeX;
      eyeRight.scale.x = emotionProfile.eyeX;
      eyeLeft.scale.y = emotionProfile.eyeY * eyeExpression * (1 - blink * 0.94);
      eyeRight.scale.y = emotionProfile.eyeY * eyeExpression * (1 - blink * 0.94);
      if (listening) {
        ringMaterial.opacity = 0.65;
        faceLight.intensity = 5.2;
      } else if (speaking) {
        ringMaterial.opacity = 0.8;
        faceLight.intensity = 6.4;
      } else {
        ringMaterial.opacity = 0.46;
        faceLight.intensity = emotionProfile.idleGlow + Math.sin(elapsed * 1.8) * 0.18;
      }
      if (state !== lastState) {
        wrapper.setAttribute("aria-label", "Awatar Cortany, stan: " + (labelsForState(state)));
        lastState = state;
      }
      renderer.render(scene, camera);
      window.requestAnimationFrame(animate);
    }
    function labelsForState(state) {
      return ({idle:"gotowa", listening:"nasłuchuje", thinking:"przetwarza", speaking:"mówi"})[state] || "gotowa";
    }
    animate();
  } catch (_) {
    wrapper.classList.remove("three-active");
  }
})();
