var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,    // Resolusi tampilan awal
    height: window.innerHeight,
    physics: {
         default: 'arcade',
         arcade: {
             gravity: { y: 0 },
             debug: false
         }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,  // Menyesuaikan ukuran game agar memenuhi layar
        autoCenter: Phaser.Scale.CENTER_BOTH,  // Pusatkan game di tengah layar
    },
    scene: {
         preload: preload,
         create: create,
         update: update
    }
};

async function requestMicrophoneAccess() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("✅ Microphone access granted");
        } catch (error) {
            console.error("❌ Microphone access error:", error);
        }
    } else {
        console.error("⚠️ Browser does not support microphone access!");
    }
}


// === ML: Variabel yang berhubungan dengan Machine Learning (Teachable Machine) ===
var audioModel;            // ML: Model yang dimuat dari Teachable Machine
var audioContext;          // ML: Audio context untuk menangkap input mikrofon
var analyser;              // ML: Analyser untuk memperoleh data audio
var microphone;            // ML: Sumber audio dari mikrofon
var audioDataArray;        // ML: Array data audio (Float32Array)
var lastAudioPredictionTime = 0;
var audioPredictionCooldown = 300; // ML: Interval prediksi (dalam ms)
var lastCommand = "none";  // ML: Hasil prediksi perintah audio
var minConfidence = 0.7;   // ML: Minimum confidence score untuk diterima
// === End ML Variables ===
 
var speechRecognition;
var isListening = false;

// === Voice Recognition System ===
var speechRecognition;
var isListening = false;

var lastVoiceShootTime = 0;
var voiceShootCooldown = 200; // Delay aman antara tembakan suara
var lastDetectedTranscript = "";


// === Fix untuk Voice Recognition ===
function initVoiceRecognition() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Web Speech API not supported");
            return;
        }

        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = true;
        speechRecognition.interimResults = true; // aktivasi hasil interim
        speechRecognition.lang = 'id-ID'; // sesuaikan dengan cara bicara kamu

        speechRecognition.onresult = function(event) {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                const transcript = result[0].transcript.trim().toUpperCase();

                // Hanya lanjut kalau ada kata yang mirip DOR
                if (transcript.includes("DOR") || transcript.includes("DOOR") || transcript.includes("DORE")) {
                    const now = Date.now();

                    // Pastikan tidak spam dalam waktu terlalu dekat
                    if (
                        now - lastVoiceShootTime > voiceShootCooldown ||
                        transcript !== lastDetectedTranscript // hindari trigger ulang dari interim yang sama
                    ) {
                        lastVoiceShootTime = now;
                        lastDetectedTranscript = transcript;

                        triggerShootAction();
                        console.log("🔊 Fast voice trigger:", transcript);
                    }
                }
            }
        };



        speechRecognition.onerror = function(event) {
            console.error("Speech recognition error:", event.error);

            // Tangani error spesifik
            if (event.error === 'no-speech') {
                console.warn("⚠️ Tidak ada suara terdeteksi, coba restart mic...");
                setTimeout(startListening, 800);
            } else if (event.error === 'audio-capture') {
                console.warn("🚫 Mikrofon tidak tersedia atau diblok.");
                showMicWarning("❌ Mikrofon tidak terdeteksi. Periksa pengaturan mic.");
            } else {
                // Error lain → coba restart
                if (isListening) {
                    setTimeout(startListening, 1000);
                }
            }
        };


        speechRecognition.onend = function () {
            console.warn("Speech recognition ended unexpectedly.");
            if (isListening) {
                showMicWarning("Mic mati, mencoba reconnect...");
                setTimeout(startListening, 500);
            }
        };

        function showMicWarning(msg) {
            const warning = document.getElementById("mic-warning");
            if (warning) warning.innerText = msg;
        }


        startListening();
    } catch (error) {
        console.error("initVoiceRecognition error:", error);
    }
}

function startListening() {
    if (!speechRecognition || isListening) return;

    try {
        speechRecognition.start();
        isListening = true;
        console.log("🎙️ Voice recognition started");
    } catch (e) {
        console.warn("⚠️ Error starting recognition:", e);
        try {
            speechRecognition.abort(); // tambahkan ini untuk reset
        } catch (err) {
            console.warn("Abort failed:", err);
        }
        setTimeout(startListening, 1000);
    }
}


function requestMicrophoneAccess() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                console.log("Microphone access granted");
                // Tidak perlu diputar kembali
            })
            .catch(function(error) {
                console.error("Microphone access error", error);
            });
    } else {
        console.error("Browser does not support microphone access!");
    }
}

// Saat mulai game:
window.onload = async function () {
    try {
        await requestMicrophoneAccess();
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume(); // ini penting!
        }
        initVoiceRecognition();
    } catch (err) {
        console.error("Mic access/init failed:", err);
    }
};



// Modified triggerShootAction to better integrate with weapon system
function triggerShootAction() {
    // Check if we have a valid scene and player
    if (!player || !player.scene || isGameOver) return;
    
    // Check weapon conditions
    if (hasWeapon && ammo.clip > 0 && (Date.now() - lastShotTime >= shotCooldown)) {
        lastShotTime = Date.now();
        shootWeapon(); // Use the existing shoot function
        ammo.clip--;
        console.log("Shoot action triggered by VOICE, ammo left: " + ammo.clip);
        
        // Cancel any ongoing reload
        cancelReload();
        
        // Visual feedback
        const scene = player.scene;
        if (scene && !scene.voiceFeedback) {
            scene.voiceFeedback = scene.add.text(
                player.x, player.y - 50, 
                "DOR!", 
                { 
                    fontSize: '24px', 
                    fill: '#ff0000', 
                    fontWeight: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setDepth(10);
            
            scene.tweens.add({
                targets: scene.voiceFeedback,
                y: player.y - 100,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    if (scene.voiceFeedback) {
                        scene.voiceFeedback.destroy();
                        scene.voiceFeedback = null;
                    }
                }
            });
        }
    } else {
        console.log("Voice trigger failed: no ammo or on cooldown");
    }
}

var game = new Phaser.Game(config);

// Deklarasi variabel global
var player;
var cursors;
var sprintKey; // Tombol sprint (SHIFT)
var zombies;
var loot;
var playerData;        // Data player: health, stamina, hunger
var healthBar, staminaBar, hungerBar;  // UI bars
var ammoText; // Tampilan ammo senjata
var hasWeapon = true; // testing dulu, nanti ubah ke false
var ammo = { clip: 6, reserve: 36 };
var reloadKey, dropWeaponKey;
var laserLine; // Laser bantuan penargetan
var weaponDamage = 5;
var startTime = 0;  // Untuk menghitung waktu dari awal scene pergantian01
var reloadSound;    // Suara reload senjata
var zombieHitSound; // Suara zombie menghit player
var playerHurtSound; // Suara saat player terkena hit
var bgMusic; // Hanya perlu satu variabel ini
var hasStartedMusic = false;




var elapsedTime = 0;      // Waktu hidup player (detik)
var isGameOver = false;   // Flag untuk status game over
var enableGameOver = true; // Set ke false untuk menonaktifkan mekanik game over saat pengembangan
var timeText;
var shootSound;  // Variabel untuk menyimpan sound object
var energySound;  // Variabel untuk menyimpan sound object energy
var healSound;      // Untuk medkit dan food
var weaponPickupSound; // untuk senjtata
var deathSound;  // Variabel untuk suara kematian player

// Variabel untuk cooldown tembakan dan reload (dalam ms)
var lastShotTime = 0;
var shotCooldown = 280;  // Sesuaikan delay antar tembakan (misal 280ms)

var lastReloadTime = 0;
var reloadDelay = 3000;  // Sesuaikan delay reload (misal 3000ms)
var isReloading = false;
var reloadTimer = null;
var justCancelledReload = false;

// Variabel untuk menyimpan senjata yang dipegang (weaponSprite)
var weaponSprite = null;
var lastBoundaryDamageTime = 0;
var boundaryDamageCooldown = 1000; // ms
//batas map
var barriers; // Grup untuk jeruji kawat
//controller
var useController = false;
var currentPad = null;
var dropCooldown = 0;

var lastLaserDirection = new Phaser.Math.Vector2(1, 0); // default arah kanan
var lastLaserEndPoint = { x: 0, y: 0 };

var batuGroup;



function preload() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // --- STEP 1: load logo duluan ---
    this.load.image('logo', 'assets/sprites/logogame.png');

    // --- STEP 2: ketika logo siap, langsung render ---
    this.load.once('filecomplete-image-logo', () => {
        // Render logo duluan dengan scaling
        const logo = this.add.image(centerX, centerY - 80, 'logo').setOrigin(0.5);
        logo.setScale(0.3); // kecilin jadi 30% (bisa disesuaikan)

        // Bikin progress bar di bawah logo
        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        const barWidth = 300;
        const barHeight = 20;
        const barX = centerX - barWidth / 2;
        const barY = centerY + 20;

        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(barX, barY, barWidth, barHeight);

        this.load.on('progress', function (value) {
            progressBar.clear();
            progressBar.fillStyle(0x8B0000, 1);
            progressBar.fillRect(barX, barY, barWidth * value, barHeight);
        });
        const micInfoText = this.add.text(centerX, barY + 30, 'Pastikan Microphone web anda nyala!', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('complete', function () {
            logo.destroy();
            progressBox.destroy();
            progressBar.destroy();
            micInfoText.destroy();
        });
    });
    
    // Preload asset untuk player, zombie, background
    this.load.image('player', 'assets/sprites/depan_1.png');
    this.load.image('zombie', 'assets/sprites/zombie.png');
    this.load.image('background', 'assets/sprites/background.png');

    // Preload asset loot: Medkit, Energy Drink, Food, dan weapon
    this.load.image('medkit', 'assets/sprites/medkit.png');
    this.load.image('energy', 'assets/sprites/energy.png');
    this.load.image('food', 'assets/sprites/food.png');
    this.load.image('weapon', 'assets/sprites/revolver.png');
    //jeruji map
    this.load.image('jeruji', 'assets/sprites/jeruji_kawat.png');
    this.load.audio('shootSound', 'assets/sounds/player_shoot.mp3');
    this.load.audio('energySound', 'assets/sounds/item_energy.mp3');
    this.load.audio('healSound', 'assets/sounds/item_heal.mp3'); // Untuk medkit dan food
    this.load.audio('weaponPickup', 'assets/sounds/item_pickup.mp3'); //
    this.load.audio('reloadSound', 'assets/sounds/player_reload.mp3');
    this.load.audio('zombieHit', 'assets/sounds/zombie_hit.mp3');
    this.load.audio('playerHurt', 'assets/sounds/player_hurt.mp3');
    this.load.audio('deathSound', 'assets/sounds/player_dead.mp3');
    this.load.audio('bgm', 'assets/sounds/game_bgm.mp3');
    this.load.image('batu', 'assets/sprites/batu.png');
    this.load.image('darah', 'assets/sprites/genangan.png');
    this.load.image('darah2', 'assets/sprites/genangan2.png');
    this.load.image('darah3', 'assets/sprites/genangan3.png');
    this.load.image('tangkai', 'assets/sprites/tangkai.png');

}


function create() {

    // Di bagian create(), tambahkan:
    this.redOverlay = this.add.graphics();
    this.redOverlay.fillStyle(0xff0000, 0.5);
    this.redOverlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.redOverlay.setScrollFactor(0);
    this.redOverlay.setDepth(9); // Di bawah UI tapi di atas game
    this.redOverlay.setVisible(false);  

    if (typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined') {
    initVoiceRecognition();
} else {
    console.warn("Browser tidak mendukung Web Speech API");
    // Fallback: bisa tambahkan tombol untuk tembak manual
}

    if (this.input.gamepad) {
    this.input.gamepad.enabled = true;
    this.input.gamepad.once('connected', (pad) => {
        console.log('🎮 Gamepad connected:', pad.id);
        useController = true;
        currentPad = pad;
    });
        // Cek jika sudah terkoneksi sebelumnya
    if (this.input.gamepad.total > 0) {
        const pad = this.input.gamepad.getPad(0);
        console.log('🎮 Gamepad already connected:', pad.id);
        useController = true;
        currentPad = pad;
    }
}

    startTime = this.time.now; // Simpan waktu mulai scene pergantian 02
    // Reset elapsed time setiap kali scene dibuat ulang
    elapsedTime = 0;
    isGameOver = false;

    // Tambahkan background dan set depth ke 0
    var bg = this.add.image(0, 0, 'background').setOrigin(0, 0);
    bg.setDepth(0);

    this.physics.world.setBounds(0, 0, 2000, 2000);
    
    //dekorasi
    batuGroup = spawnRandomDekorasi(this, 'batu', 34, 150, 1.0, 1.3);
    darah3Group = spawnRandomDekorasi(this, 'darah3', 10, 450, 0.098, 0.1,90 ,50 ,-2);
    tangkaiGroup = spawnRandomDekorasi(this, 'tangkai', 25, 137, 0.5, 0.8, -45,90);






    var spawnX = Phaser.Math.Between(64, 2000 - 64);
    var spawnY = Phaser.Math.Between(64, 2000 - 64);
    player = this.physics.add.sprite(spawnX, spawnY, 'player');
    player.setCollideWorldBounds(true);
    player.setDepth(3);

    player.shadow = createShadow(this, player);

    // Setup kamera mengikuti player
    this.cameras.main.startFollow(player);
    this.cameras.main.setBounds(0, 0, 2000, 2000);

    // Setup kontrol keyboard
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    sprintKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    reloadKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    dropWeaponKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    // Grup zombie dan loot
    zombies = this.physics.add.group();
    loot = this.physics.add.group();

    // Event spawn zombie dan loot
    this.time.addEvent({
        delay: 3000,
        callback: spawnZombie,
        callbackScope: this,
        loop: true
    });

    this.time.addEvent({
        delay: 5000,
        callback: spawnLoot,
        callbackScope: this,
        loop: true
    });
    this.time.addEvent({
        delay: 1000,
        callback: function() {
            elapsedTime += 1;
        },
        loop: true
    });


    // UI elemen
    timeText = this.add.text(0, 0, 'Time: 0.0', { fontSize: '20px', fill: '#fff' });
    timeText.setScrollFactor(0).setDepth(4);

    ammoText = this.add.text(0, 0, '', { fontSize: '20px', fill: '#fff' });
    ammoText.setScrollFactor(0).setDepth(4);

    healthBar = this.add.graphics().setScrollFactor(0).setDepth(4);
    staminaBar = this.add.graphics().setScrollFactor(0).setDepth(4);
    hungerBar = this.add.graphics().setScrollFactor(0).setDepth(4);

    playerData = { health: 100, stamina: 100, hunger: 100 };

    // Laser line untuk aiming
    laserLine = this.add.graphics();
    laserLine.setDepth(2);

    // Setup overlap dan collider
    this.physics.add.overlap(player, loot, collectLoot, null, this);
    this.physics.add.collider(player, zombies, zombieAttack, null, this);
    this.physics.add.collider(zombies, zombies);

    // Setup pointer input untuk menembak
    this.input.on('pointerdown', function(pointer) {
        if (isGameOver) return;

        if (pointer.leftButtonDown()) {
            if (hasWeapon && ammo.clip > 0 && (Date.now() - lastShotTime >= shotCooldown)) {
                lastShotTime = Date.now();
                shootWeapon();
                ammo.clip--;
                console.log("Left click tembak, ammo tersisa: " + ammo.clip);
            } else {
                console.log("Tidak bisa tembak: cooldown atau tidak ada senjata/ammo");
            }
        }
    }, this);

    

    // Update posisi UI pertama kali
    updateUIPositions(this);

    // === Sangat Penting ===
    // Update UI saat layar diresize atau fullscreen
    this.scale.on('resize', (gameSize, baseSize, displaySize, resolution) => {
        updateUIPositions(this);
    });

    let waitForTM = setInterval(() => {
        if (window.tm && tm.audio) {
            clearInterval(waitForTM);
            initVoiceRecognition();
        }
    }, 100);


    // Tambah jeruji di keempat sisi map
    barriers = this.physics.add.staticGroup();

    let jerujiWidth = 128; // width asli jeruji
    let jerujiHeight = 32; // height asli jeruji
    let scaleX = 0.3;
    let scaleY = 0.3;

    let mapWidth = 2000;
    let mapHeight = 2000;

    // TOP - repeat sepanjang atas
    for (let x = 0; x < mapWidth; x += jerujiWidth * scaleX) {
        let b = barriers.create(x, 0, 'jeruji').setOrigin(0, 0);
        b.setScale(scaleX, scaleY).refreshBody();
        b.setDepth(3); // ⬅️ ini penting

    }

    // BOTTOM - rotate 180
    for (let x = 0; x < mapWidth; x += jerujiWidth * scaleX) {
        let b = barriers.create(x, mapHeight - jerujiHeight * scaleY, 'jeruji').setOrigin(0, 0);
        b.setRotation(Phaser.Math.DegToRad(180));
        b.setScale(scaleX, scaleY).refreshBody();
        b.setDepth(3); // ⬅️ ini penting

    }

    // LEFT - rotate -90
    for (let y = 0; y < mapHeight; y += jerujiWidth * scaleX) {
        let b = barriers.create(0, y, 'jeruji').setOrigin(0, 0);
        b.setRotation(Phaser.Math.DegToRad(-90));
        b.setScale(scaleX, scaleY).refreshBody();
        b.setDepth(3); // ⬅️ ini penting

    }

    // RIGHT - rotate 90
    for (let y = 0; y < mapHeight; y += jerujiWidth * scaleX) {
        let b = barriers.create(mapWidth - jerujiHeight * scaleY, y, 'jeruji').setOrigin(0, 0);
        b.setRotation(Phaser.Math.DegToRad(90));
        b.setScale(scaleX, scaleY).refreshBody();
        b.setDepth(3); // ⬅️ ini penting
    }

    // Tambahan listener global (penting untuk debug)
    window.addEventListener("gamepadconnected", function(e) {
        console.log("🔌 Gamepad connected at index %d: %s. %d buttons, %d axes.",
            e.gamepad.index, e.gamepad.id,
            e.gamepad.buttons.length, e.gamepad.axes.length);
    });
    shootSound = this.sound.add('shootSound');
    energySound = this.sound.add('energySound');
    healSound = this.sound.add('healSound'); // Untuk medkit dan food
    weaponPickupSound = this.sound.add('weaponPickup'); 
    reloadSound = this.sound.add('reloadSound');
    zombieHitSound = this.sound.add('zombieHit');
    playerHurtSound = this.sound.add('playerHurt');
    //bgm wak
    deathSound = this.sound.add('deathSound');
     bgMusic = this.sound.add('bgm', {
        loop: true,
        volume: 0.3 // Sesuaikan volume
    });
    
}

function updateUIPositions(scene) {
    // Mendapatkan ukuran layar yang sesungguhnya
    var width = scene.sys.game.config.width;
    var height = scene.sys.game.config.height;

    // Ukuran font responsif
    var fontSize = Math.min(width / 30, 40); // Ukuran font responsif berdasarkan lebar layar
    var ammoFontSize = Math.min(width / 30, 40); // Ukuran font untuk ammo, lebih besar juga

    // Update ukuran font
    timeText.setStyle({ fontSize: fontSize + 'px' });
    ammoText.setStyle({ fontSize: ammoFontSize + 'px' });

    // Posisi waktu (tengah bagian atas layar)
    timeText.setPosition(width / 2 - timeText.width / 2, 20);  // Menempatkan waktu di tengah bagian atas layar (horizontal)

    // Posisi indikator ammo (di bawah indikator bar)
    ammoText.setPosition(width - 180, height - 60);  // Menempatkan ammo tepat di bawah indikator bar

    // Posisi bar indikator (Health, Stamina, Hunger) di pojok kiri atas
    var barWidth = width * 0.6;  // Lebar bar proporsional terhadap lebar layar
    var barHeight = 20; // Tinggi bar

    // Update posisi dan ukuran bar
    healthBar.clear();
    healthBar.fillStyle(0xff0000, 1);
    healthBar.fillRect(20, 20, playerData.health * 2, barHeight);

    staminaBar.clear();
    staminaBar.fillStyle(0xffff00, 1);
    staminaBar.fillRect(20, 50, playerData.stamina * 2, barHeight);

    hungerBar.clear();
    hungerBar.fillStyle(0xffa500, 1);
    hungerBar.fillRect(20, 80, playerData.hunger * 2, barHeight);

    // Resize UI bar sesuai dengan ukuran layar
    healthBar.fillRect(20, 20, playerData.health * 2 * (barWidth / width), barHeight);  // Health
    staminaBar.fillRect(20, 50, playerData.stamina * 2 * (barWidth / width), barHeight);  // Stamina
    hungerBar.fillRect(20, 80, playerData.hunger * 2 * (barWidth / width), barHeight);  // Hunger
}

function createShadow(scene, owner, scale = 1) {
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.25); // warna hitam transparan
    shadow.fillEllipse(0, 0, 40 * scale, 15 * scale); // lebar & tinggi ellipse
    shadow.setDepth(owner.depth - 1);
    return shadow;
}

function update(time, delta) {
    if (isGameOver) return;
    
    if (useController && currentPad) {
    console.log("CURRENT PAD:", currentPad);
    console.log("AXES LEN:", currentPad.axes.length);
    console.log("AXIS RAW:", currentPad.axes);
    console.log("AXIS L:", currentPad.axes[0]?.getValue?.(), currentPad.axes[1]?.getValue?.());
}


        // Cek proximity ke jeruji → atur slowFactor berdasarkan jarak
    let slowFactor = 1;
    barriers.children.iterate(function(jeruji) {
        let dist = Phaser.Math.Distance.Between(player.x, player.y, jeruji.x, jeruji.y);
        if (dist < 100) {
            let localSlow = Phaser.Math.Clamp(1 - (100 - dist) / 100, 0.2, 1); // max slow 10%
            if (localSlow < slowFactor) {
                slowFactor = localSlow; // ambil slowest jika dekat beberapa jeruji
            }
        }
    });
    
    if (player.shadow) {
        player.shadow.setPosition(player.x, player.y + 20);
    }

    zombies.getChildren().forEach(z => {
        if (z.shadow) z.shadow.setPosition(z.x, z.y + 20);
    });

    loot.getChildren().forEach(item => {
        if (item.shadow) item.shadow.setPosition(item.x, item.y + 20);
    });

    var dt = delta / 1000;
    var baseSpeed = 200 * slowFactor;
    var runSpeed = 300 * slowFactor;
    var speed = baseSpeed;

    if (sprintKey.isDown && playerData.stamina > 0) {
        speed = runSpeed;
    }    

    // === Perbaikan Waktu Hidup ===
    elapsedTime = (time - startTime) / 1000; //pergantian 03
 // Gunakan waktu dari Phaser secara langsung
    timeText.setText( elapsedTime.toFixed(1));

    
    if (enableGameOver && playerData.health <= 0 && !isGameOver) {
        gameOver(this);
    }

    // Panggil untuk update posisi dan ukuran UI
    updateUIPositions(this);

    // Logika Hunger
    if (playerData.hunger > 0) {
        playerData.hunger -= 1 * dt;
    } else {
        playerData.health -= 2 * dt;
    }
    playerData.hunger = Phaser.Math.Clamp(playerData.hunger, 0, 100);
    if (playerData.hunger === 100) {
        if (!this.hungerFullTime) {
            this.hungerFullTime = time;
        } else if (time - this.hungerFullTime >= 5000) {
            playerData.hunger -= 1 * dt;
        }
        playerData.health = Phaser.Math.Clamp(playerData.health + 3 * dt, 0, 100);
        baseSpeed = 200;
        runSpeed = 299;
    } else {
        this.hungerFullTime = null;
    }
    
    
    
    // Logika Stamina
    if (playerData.stamina > 0 && (cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown)) {
        // Stamina berkurang saat berjalan
        if (sprintKey.isDown) {
            playerData.stamina -= 10 * dt;  // Berlari
        } else {
            playerData.stamina -= 3 * dt;   // Berjalan
        }
    }

     // Stamina bertambah saat berhenti bergerak
     if (playerData.stamina < 100 && !isMoving) {
        // Bertambah 2 hingga 3 setiap detik saat diam
        playerData.stamina += Phaser.Math.FloatBetween(2, 5) * dt;
    }

    // Pastikan stamina tidak kurang dari 0 atau lebih dari 100
    playerData.stamina = Phaser.Math.Clamp(playerData.stamina, 0, 100);

    // Update UI Stamina Bar
    staminaBar.clear();
    staminaBar.fillStyle(0xffff00, 1);  // Warna kuning
    staminaBar.fillRect(20, 50, playerData.stamina * 2, 20);  // Lebar bar berdasarkan nilai stamina

    // Reset gerakan
    let velocityX = 0;
    let velocityY = 0;
    isMoving = false;

    // === Kontrol: Prioritaskan controller jika aktif ===
    if (useController && currentPad) {
        let axisH = currentPad.axes.length > 0 ? currentPad.axes[0].getValue() : 0;
        let axisV = currentPad.axes.length > 1 ? currentPad.axes[1].getValue() : 0;

        // Deadzone biar gak gerak sendiri
        if (Math.abs(axisH) > 0.1) {
            velocityX = axisH * speed;
            isMoving = true;
        }
        if (Math.abs(axisV) > 0.1) {
            velocityY = axisV * speed;
            isMoving = true;
        }

    } else {
        // === Keyboard WASD ===
        if (cursors.left.isDown || lastCommand === 'left') {
            velocityX = -speed;
            isMoving = true;
        } else if (cursors.right.isDown || lastCommand === 'right') {
            velocityX = speed;
            isMoving = true;
        }

        if (cursors.up.isDown || lastCommand === 'up') {
            velocityY = -speed;
            isMoving = true;
        } else if (cursors.down.isDown || lastCommand === 'down') {
            velocityY = speed;
            isMoving = true;
        }

        // Gerakan diagonal untuk keyboard
        if (cursors.up.isDown && cursors.left.isDown) {
            velocityX = -speed * 0.7071;
            velocityY = -speed * 0.7071;
        }
        if (cursors.up.isDown && cursors.right.isDown) {
            velocityX = speed * 0.7071;
            velocityY = -speed * 0.7071;
        }
        if (cursors.down.isDown && cursors.left.isDown) {
            velocityX = -speed * 0.7071;
            velocityY = speed * 0.7071;
        }
        if (cursors.down.isDown && cursors.right.isDown) {
            velocityX = speed * 0.7071;
            velocityY = speed * 0.7071;
        }

        // === ⬅️ FlipX logic player ===
        if (velocityX < 0) {
            player.setFlipX(true); // Jalan ke kiri
        } else if (velocityX > 0) {
            player.setFlipX(false); // Jalan ke kanan
        }
    }

    // Apply velocity ke player
    player.setVelocity(velocityX, velocityY);

    if (!hasStartedMusic && isMoving && bgMusic && !bgMusic.isPlaying) {
        bgMusic.play();
        hasStartedMusic = true;
    }

    // Mengatur kecepatan player berdasarkan arah
    player.setVelocity(velocityX, velocityY);  // Menggerakkan player ke arah yang diinginkan

        // === Cek overlap dengan jeruji ===
    let touchingJeruji = false;
    barriers.children.iterate(function(jeruji) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), jeruji.getBounds())) {
            touchingJeruji = true;

            if (time - lastBoundaryDamageTime >= boundaryDamageCooldown) {
                playerData.health = Math.max(0, playerData.health - 25);
                lastBoundaryDamageTime = time;

                // Mainkan suara player hurt
                if (playerHurtSound) {
                playerHurtSound.play();
                } 
            
                // Efek hit sama kayak zombie
                var scene = player.scene;

                scene.cameras.main.shake(200, 0.01);

                if (!scene.redOverlay) {
                    scene.redOverlay = scene.add.rectangle(0, 0, scene.cameras.main.width, scene.cameras.main.height, 0xff0000, 0.3);
                    scene.redOverlay.setOrigin(0, 0);
                    scene.redOverlay.setScrollFactor(0);
                    scene.redOverlay.setDepth(10);
                }

                scene.redOverlay.setVisible(true);
                scene.redOverlay.alpha = 0.3;

                scene.tweens.add({
                    targets: scene.redOverlay,
                    alpha: 0,
                    duration: 300,
                    ease: 'Linear',
                    onComplete: function () {
                        scene.redOverlay.setVisible(false);
                    }
                });
            }

        }
    });
    
    // Update UI bars
    healthBar.clear();
    healthBar.fillStyle(0xff0000, 1);
    healthBar.fillRect(20, 20, playerData.health * 2, 20);

    staminaBar.clear();
    staminaBar.fillStyle(0xffff00, 1);
    staminaBar.fillRect(20, 50, playerData.stamina * 2, 20);

    hungerBar.clear();
    hungerBar.fillStyle(0xffa500, 1);
    hungerBar.fillRect(20, 80, playerData.hunger * 2, 20);

    // Update pergerakan zombie
    zombies.getChildren().forEach(function(zombie) {
        var distance = Phaser.Math.Distance.Between(zombie.x, zombie.y, player.x, player.y);
        if (distance < 300) {
            this.physics.moveToObject(zombie, player, 100);
            if (distance < 300) {
            this.physics.moveToObject(zombie, player, 100);

            // === FlipX untuk zombie ===
            let dx = player.x - zombie.x;
            if (Math.abs(dx) > 5) {
                zombie.setFlipX(dx < 0); // Jika player di kanan → mirror
            }
        }

            
        } else {
            if (!zombie.randomDirectionTimer || time > zombie.randomDirectionTimer) {
                zombie.randomDirection = new Phaser.Math.Vector2(
                    Phaser.Math.FloatBetween(-1, 1),
                    Phaser.Math.FloatBetween(-1, 1)
                ).normalize();
                zombie.randomDirectionTimer = time + Phaser.Math.Between(1000, 3000);
            }
            zombie.setVelocity(zombie.randomDirection.x * 50, zombie.randomDirection.y * 50);
        }
    }, this);
    
    // Mekanik Senjata: gambar laser dan update ammo
    laserLine.clear();
    if (hasWeapon) {
        var pointer = this.input.activePointer;
        var worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        var dx = worldPoint.x - player.x;
        var dy = worldPoint.y - player.y;
        var laserDir = new Phaser.Math.Vector2(dx, dy);
        if (laserDir.length() === 0) {
            laserDir.set(1, 0);
        } else {
            laserDir.normalize();
        }
        var maxLaserLength = 200;
        var hitDistance = maxLaserLength;
        var angleTolerance = 10;
        
        zombies.getChildren().forEach(function(zombie) {
            var zombieVec = new Phaser.Math.Vector2(zombie.x - player.x, zombie.y - player.y);
            var dist = zombieVec.length();
            if (dist <= maxLaserLength) {
                var zombieDir = zombieVec.clone().normalize();
                var dot = Phaser.Math.Clamp(laserDir.dot(zombieDir), -1, 1);
                var angleDiff = Phaser.Math.RadToDeg(Math.acos(dot));
                if (angleDiff < angleTolerance && dist < hitDistance) {
                    hitDistance = dist;
                }
            }
        });
        
        var endX = player.x + laserDir.x * hitDistance;
        var endY = player.y + laserDir.y * hitDistance;
        
        laserLine.lineStyle(2, 0xff0000, 1);
        laserLine.beginPath();
        laserLine.moveTo(player.x, player.y);
        laserLine.lineTo(endX, endY);
        laserLine.strokePath();
        lastLaserDirection = laserDir.clone(); // simpan arah lase
        lastLaserEndPoint = { x: endX, y: endY }; // simpan titik akhir laser

        
        ammoText.setText( ammo.clip + '/' + ammo.reserve);
    } else {
        ammoText.setText('');
    }
    
    // Mekanik reload dengan delay untuk mencegah spam
if (Phaser.Input.Keyboard.JustDown(reloadKey) && hasWeapon && ammo.reserve > 0 && ammo.clip < 6 && !isReloading) {
    isReloading = true;

    if (reloadSound) reloadSound.play();

    let bulletsToAdd = Math.min(6 - ammo.clip, ammo.reserve);
    let added = 0;

    reloadTimer = player.scene.time.addEvent({
        delay: 500, // 0.5 detik
        repeat: bulletsToAdd - 1,
        callback: () => {
            if (!isReloading) return; // Kalau reload dibatalkan di tengah jalan

            ammo.clip += 1;
            ammo.reserve -= 1;
            added++;

            if (ammo.clip >= 6 || ammo.reserve <= 0 || added >= bulletsToAdd) {
                isReloading = false;
                if (reloadSound && reloadSound.isPlaying) reloadSound.stop();
            }
        },
        callbackScope: this,
        onComplete: () => {
            isReloading = false;
            if (reloadSound && reloadSound.isPlaying) reloadSound.stop();
        }
    });
}


    
    // Mekanik drop weapon
    if (Phaser.Input.Keyboard.JustDown(dropWeaponKey) && hasWeapon) {
        let droppedAmmo = { clip: ammo.clip, reserve: ammo.reserve };
        hasWeapon = false;

        let droppedWeapon;

        if (weaponSprite) {
            droppedWeapon = loot.create(weaponSprite.x, weaponSprite.y, 'weapon');
            droppedWeapon.lootType = 'weapon';
            droppedWeapon.ammo = droppedAmmo;
            droppedWeapon.setDepth(1);
            droppedWeapon.justDropped = true;

            weaponSprite.destroy();
            weaponSprite = null;
        } else {
            droppedWeapon = loot.create(player.x, player.y, 'weapon');
            droppedWeapon.lootType = 'weapon';
            droppedWeapon.ammo = droppedAmmo;
            droppedWeapon.setDepth(1);
            droppedWeapon.justDropped = true;
        }

        // === Tambahkan shadow ke weapon yang dijatuhkan
        droppedWeapon.shadow = createShadow(this, droppedWeapon, 0.8);

        ammo.clip = 0;
        ammo.reserve = 0;

        this.time.delayedCall(500, function() {
            if (droppedWeapon) {
                droppedWeapon.justDropped = false;
            }
        });

        if (droppedAmmo.clip === 0 && droppedAmmo.reserve === 0) {
            this.time.delayedCall(5000, function() {
                if (droppedWeapon && droppedWeapon.active) {
                    if (droppedWeapon.shadow) droppedWeapon.shadow.destroy(); // destroy shadow juga
                    droppedWeapon.destroy();
                }
            });
        }
    }

    
    // Update posisi dan rotasi senjata yang dipegang agar mengikuti player dan laser,
    // dengan mirror secara vertikal jika pointer berada di sebelah kiri player.
    if (hasWeapon && weaponSprite) {
        var pointer = this.input.activePointer;
        var worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        var dx = worldPoint.x - player.x;
        var dy = worldPoint.y - player.y;
        var angle = Math.atan2(dy, dx);
        var offset = 20; // Jarak senjata dari player (sesuaikan sesuai keinginan)
        
        weaponSprite.x = player.x + Math.cos(angle) * offset;
        weaponSprite.y = player.y + Math.sin(angle) * offset;
        weaponSprite.rotation = angle;
        
        // Jika pointer berada di sebelah kiri player (dx < 0), mirror secara vertikal.
        if (dx < 0) {
            weaponSprite.setFlipY(true);
        } else {
            weaponSprite.setFlipY(false);
        }
        // Pastikan senjata berada di atas player
        weaponSprite.setDepth(player.depth + 1);
    }
    
    if (useController && currentPad) {
    // === 1. Analog kiri untuk gerak ===
    let axisH = currentPad.axes.length > 0 ? currentPad.axes[0].getValue() : 0;
    let axisV = currentPad.axes.length > 1 ? currentPad.axes[1].getValue() : 0;

    if (Math.abs(axisH) > 0.1) {
        velocityX = axisH * speed;
        isMoving = true;
    }
    if (Math.abs(axisV) > 0.1) {
        velocityY = axisV * speed;
        isMoving = true;
    }

    // === 2. Analog kanan untuk laser ===
    let rightX = currentPad.axes.length > 2 ? currentPad.axes[2].getValue() : 0;
    let rightY = currentPad.axes.length > 3 ? currentPad.axes[3].getValue() : 0;

    if (Math.abs(rightX) > 0.2 || Math.abs(rightY) > 0.2) {
        let laserDir = new Phaser.Math.Vector2(rightX, rightY).normalize();
        let laserLength = 200;
        let endX = player.x + laserDir.x * laserLength;
        let endY = player.y + laserDir.y * laserLength;

        laserLine.clear();
        laserLine.lineStyle(2, 0xff0000, 1);
        laserLine.beginPath();
        laserLine.moveTo(player.x, player.y);
        laserLine.lineTo(endX, endY);
        laserLine.strokePath();
    }

    // === 3. Tombol L2 untuk sprint (index 6)
    if (currentPad.buttons[6].pressed && playerData.stamina > 0) {
        speed = runSpeed;
    }

    // === 4. Tombol R2 untuk tembak (index 7)
    if (currentPad.buttons[7].pressed && hasWeapon && ammo.clip > 0 && (Date.now() - lastShotTime >= shotCooldown)) {
        lastShotTime = Date.now();
        shootWeapon();
        ammo.clip--;
        cancelReload();

    }

    // === 5. Tombol bulat (Circle) = index 1 untuk drop weapon
    if (currentPad.buttons[1].pressed && hasWeapon && (!dropCooldown || Date.now() - dropCooldown > 300)) {
        dropCooldown = Date.now();

        // Langsung jalankan logika drop senjata kamu
        let droppedAmmo = { clip: ammo.clip, reserve: ammo.reserve };
        hasWeapon = false;

        let droppedWeapon = loot.create(player.x, player.y, 'weapon');
        droppedWeapon.lootType = 'weapon';
        droppedWeapon.ammo = droppedAmmo;
        droppedWeapon.setDepth(1);
        droppedWeapon.justDropped = true;
        droppedWeapon.shadow = createShadow(this, droppedWeapon, 0.8);
        droppedWeapon.shadow.setPosition(droppedWeapon.x, droppedWeapon.y + 20);

        if (weaponSprite) weaponSprite.destroy();
        weaponSprite = null;

        ammo.clip = 0;
        ammo.reserve = 0;

        this.time.delayedCall(500, () => {
            droppedWeapon.justDropped = false;
        });

        if (droppedAmmo.clip === 0 && droppedAmmo.reserve === 0) {
            this.time.delayedCall(5000, () => {
                if (droppedWeapon && droppedWeapon.active) {
                    if (droppedWeapon.shadow) droppedWeapon.shadow.destroy();
                    droppedWeapon.destroy();
                }
            });
        }
    }
}

}

function dropWeapon() {
    let droppedAmmo = { clip: ammo.clip, reserve: ammo.reserve };
    hasWeapon = false;

    let droppedWeapon = loot.create(player.x, player.y, 'weapon');
    droppedWeapon.lootType = 'weapon';
    droppedWeapon.ammo = droppedAmmo;
    droppedWeapon.setDepth(1);
    droppedWeapon.justDropped = true;
    droppedWeapon.shadow = createShadow(this, droppedWeapon, 0.8);
    droppedWeapon.shadow.setPosition(droppedWeapon.x, droppedWeapon.y + 20);

    if (weaponSprite) weaponSprite.destroy();
    weaponSprite = null;

    ammo.clip = 0;
    ammo.reserve = 0;

    this.time.delayedCall(500, () => { droppedWeapon.justDropped = false });

    if (droppedAmmo.clip === 0 && droppedAmmo.reserve === 0) {
        this.time.delayedCall(5000, () => {
            if (droppedWeapon && droppedWeapon.active) {
                if (droppedWeapon.shadow) droppedWeapon.shadow.destroy();
                droppedWeapon.destroy();
            }
        });
    }
}


function spawnZombie() {
    var x, y;
    var minDistance = 300;
    do {
        x = Phaser.Math.Between(0, 2000);
        y = Phaser.Math.Between(0, 2000);
    } while (Phaser.Math.Distance.Between(x, y, player.x, player.y) < minDistance);

    var zombie = zombies.create(x, y, 'zombie');
    zombie.setCollideWorldBounds(true);
    zombie.setDepth(3);
    zombie.health = 20;
    zombie.lastAttackTime = 0;
    zombie.randomDirection = new Phaser.Math.Vector2(
        Phaser.Math.FloatBetween(-1, 1),
        Phaser.Math.FloatBetween(-1, 1)
    ).normalize();
    zombie.randomDirectionTimer = 0;
    
    zombie.shadow = createShadow(player.scene, zombie, 1);
    zombie.shadow.setPosition(zombie.x, zombie.y + 20);
}

if (zombie.health <= 0) {
    // Zombie mati: kemungkinan drop loot (30% chance)
    var dropChance = 0.3;
    if (Math.random() < dropChance) {
        var possibleLoot = ['medkit', 'energy', 'food'];
        var lootIndex = Phaser.Math.Between(0, possibleLoot.length - 1);
        var lootType = possibleLoot[lootIndex];
        var newLoot = loot.create(zombie.x, zombie.y, lootType);
        newLoot.lootType = lootType;
        newLoot.setDepth(1);

        // Tambah shadow ke loot dari zombie
        newLoot.shadow = createShadow(player.scene, newLoot, 0.8);
    }

    // === Hancurkan shadow zombie sebelum zombie-nya dihancurkan
    if (zombie.shadow) zombie.shadow.destroy();

    zombie.destroy();
}

function spawnLoot() {
    var lootLimits = {
        medkit: 30,
        energy: 15,
        food: 32,
        weapon: 10
    };

    var lootTypes = Object.keys(lootLimits);
    var randomIndex = Phaser.Math.Between(0, lootTypes.length - 1);
    var lootKey = lootTypes[randomIndex];

    var currentLoot = loot.getChildren().filter(function(item) {
        return item.lootType === lootKey;
    });

    if (currentLoot.length >= lootLimits[lootKey]) {
        return;
    }

    var x = Phaser.Math.Between(0, 2000);
    var y = Phaser.Math.Between(0, 2000);
    var newLoot = loot.create(x, y, lootKey);
    newLoot.lootType = lootKey;
    newLoot.setDepth(1);
    if (lootKey === 'weapon') {
        newLoot.justDropped = false;
    }
    newLoot.shadow = createShadow(this, newLoot, 0.8);
    newLoot.shadow.setPosition(newLoot.x, newLoot.y + 20);
}

function collectLoot(player, lootItem) {
    if (lootItem.lootType === 'medkit') {
        playerData.health = Math.min(100, playerData.health + 20);
        if (lootItem.shadow) lootItem.shadow.destroy();
        lootItem.destroy();
        
        // Mainkan suara heal
        if (healSound) {
            healSound.play();
        }
    
        var scene = player.scene;
    
        if (!scene.greenOverlay) {
            scene.greenOverlay = scene.add.rectangle(0, 0, scene.cameras.main.width, scene.cameras.main.height, 0x00ff00, 0.3);
            scene.greenOverlay.setOrigin(0, 0);
            scene.greenOverlay.setScrollFactor(0);
            scene.greenOverlay.setDepth(10);
        }
    
        scene.greenOverlay.setVisible(true);
        scene.greenOverlay.alpha = 0.3;
    
        scene.tweens.add({
            targets: scene.greenOverlay,
            alpha: 0,
            duration: 400,
            ease: 'Linear',
            onComplete: function () {
                scene.greenOverlay.setVisible(false);
            }
        });
    }
    
      else if (lootItem.lootType === 'energy') {
        playerData.stamina = Math.min(100, playerData.stamina + 20);
        if (lootItem.shadow) lootItem.shadow.destroy();
        lootItem.destroy();
        
        // Mainkan suara energy
        if (energySound) {
            energySound.play();
        }
    
        var scene = player.scene;
    
        if (!scene.blueOverlay) {
            scene.blueOverlay = scene.add.rectangle(0, 0, scene.cameras.main.width, scene.cameras.main.height, 0xffff00, 0.3);
            scene.blueOverlay.setOrigin(0, 0);
            scene.blueOverlay.setScrollFactor(0);
            scene.blueOverlay.setDepth(10);
        }
    
        scene.blueOverlay.setVisible(true);
        scene.blueOverlay.alpha = 0.3;
    
        scene.tweens.add({
            targets: scene.blueOverlay,
            alpha: 0,
            duration: 400,
            ease: 'Linear',
            onComplete: function () {
                scene.blueOverlay.setVisible(false);
            }
        });
    }

     else if (lootItem.lootType === 'food') {
        playerData.hunger = Math.min(100, playerData.hunger + 20);
        if (lootItem.shadow) lootItem.shadow.destroy();
        lootItem.destroy();
        
        // Mainkan suara heal (sama seperti medkit)
        if (healSound) {
            healSound.play();
        }

        var scene = player.scene;

        if (!scene.greenOverlay) {
            scene.greenOverlay = scene.add.rectangle(0, 0, scene.cameras.main.width, scene.cameras.main.height, 0x00ff00, 0.3);
            scene.greenOverlay.setOrigin(0, 0);
            scene.greenOverlay.setScrollFactor(0);
            scene.greenOverlay.setDepth(10);
        }

        scene.greenOverlay.setVisible(true);
        scene.greenOverlay.alpha = 0.3;

        scene.tweens.add({
            targets: scene.greenOverlay,
            alpha: 0,
            duration: 400,
            ease: 'Linear',
            onComplete: function () {
                scene.greenOverlay.setVisible(false);
            }
        });
    }
    else if (lootItem.lootType === 'weapon') {
        if (!hasWeapon && !lootItem.justDropped) {
            hasWeapon = true;
            (async () => {
                await requestMicrophoneAccess();
                restartVoiceRecognition();
            })();

            if (lootItem.shadow) lootItem.shadow.destroy();
            if (lootItem.ammo) {
                ammo.clip = lootItem.ammo.clip;
                ammo.reserve = lootItem.ammo.reserve;
            } else {
                ammo.clip = 6;
                ammo.reserve = 36;
            }
            weaponSprite = lootItem;
            
            // Mainkan suara pickup senjata
            if (weaponPickupSound) {
                weaponPickupSound.play();
            }
        }
    }
}


function zombieAttack(player, zombie) {
    var currentTime = Date.now();
    if (!zombie.lastAttackTime || currentTime - zombie.lastAttackTime >= 1000) {
        playerData.health = Math.max(0, playerData.health - 10);
        zombie.lastAttackTime = currentTime;
        
        // Mainkan suara zombie hit dan player hurt
        if (zombieHitSound) zombieHitSound.play();
        if (playerHurtSound) playerHurtSound.play();

        // --- Efek hit: Shake kamera dan muncul vignette merah ---
        var scene = player.scene;
        
        // Efek kamera shake
        scene.cameras.main.shake(200, 0.05); // Intensitas shake ditingkatkan
        
        // Tambahkan overlay vignette merah
        if (!scene.redOverlay) {
            scene.redOverlay = scene.add.rectangle(
                0, 0, 
                scene.cameras.main.width * 2, // Pastikan overlay cukup besar
                scene.cameras.main.height * 2, 
                0xff0000, 0.5
            );
            scene.redOverlay.setOrigin(0.5, 0.5);
            scene.redOverlay.setScrollFactor(0);
            scene.redOverlay.setDepth(10);
            scene.redOverlay.setPosition(scene.cameras.main.centerX, scene.cameras.main.centerY);
        }
        
        scene.redOverlay.setVisible(true);
        scene.redOverlay.alpha = 0.5; // Lebih terlihat

        // Fade out vignette merah secara perlahan
        scene.tweens.add({
            targets: scene.redOverlay,
            alpha: 0,
            duration: 500, // Lebih lama
            ease: 'Linear',
            onComplete: function() {
                scene.redOverlay.setVisible(false);
            }
        });
    }
}


function shootWeapon() {
    var laserDir = lastLaserDirection.clone();
    var laserLength = 200;
    var angleTolerance = 10;

    var targetZombie = null;
    var minDistance = laserLength;
    
    zombies.getChildren().forEach(function(zombie) {
        var zombieVec = new Phaser.Math.Vector2(zombie.x - player.x, zombie.y - player.y);
        var dist = zombieVec.length();
        if (dist <= laserLength) {
            var zombieDir = zombieVec.clone().normalize();
            var dot = Phaser.Math.Clamp(laserDir.dot(zombieDir), -1, 1);
            var angleDiff = Phaser.Math.RadToDeg(Math.acos(dot));
            if (angleDiff < angleTolerance && dist < minDistance) {
                minDistance = dist;
                targetZombie = zombie;
            }
        }
    });
    
    if (targetZombie) {
        shootAtZombie(targetZombie);
    }

    if (shootSound) {
        shootSound.play();
    }
    let endX = player.x + laserDir.x * laserLength;
    let endY = player.y + laserDir.y * laserLength;
    laserLine.lineStyle(2, 0xff0000, 1);
    laserLine.beginPath();
    laserLine.moveTo(player.x, player.y);
    laserLine.lineTo(endX, endY);
    laserLine.strokePath();

}


function gameOver(scene) {
    isGameOver = true;

    if (deathSound) {
        deathSound.play();
    }

    scene.time.removeAllEvents(); // Hentikan semua event
    scene.physics.pause(); // Pause physics
    player.setTint(0xff0000); // Memberi warna merah pada player

    var centerX = scene.cameras.main.centerX;
    var centerY = scene.cameras.main.centerY;

    var bgOverlay = scene.add.rectangle(centerX, centerY, scene.cameras.main.width, scene.cameras.main.height, 0x000000, 0.5);
    bgOverlay.setScrollFactor(0);
    bgOverlay.setDepth(4);

    var gameOverText = scene.add.text(centerX, centerY - 50, 'Game Over', { fontSize: '48px', fill: '#fff' });
    gameOverText.setOrigin(0.5);
    gameOverText.setScrollFactor(0);
    gameOverText.setDepth(5);

    var timeSurvivedText = scene.add.text(centerX, centerY, 'Time Survived: ' + elapsedTime.toFixed(1) + ' sec', { fontSize: '32px', fill: '#fff' });
    timeSurvivedText.setOrigin(0.5);
    timeSurvivedText.setScrollFactor(0);
    timeSurvivedText.setDepth(5);

    var retryButton = scene.add.text(centerX, centerY + 50, 'Retry', { fontSize: '32px', fill: '#fff', backgroundColor: '#000' });
    retryButton.setOrigin(0.5);
    retryButton.setScrollFactor(0);
    retryButton.setDepth(5);
    retryButton.setPadding(10);
    retryButton.setInteractive();

    retryButton.on('pointerdown', function() {

        this.scene.restart();
        });
    
        // Reset semua variabel utama
        elapsedTime = 0;  // Pastikan waktu dimulai dari 0
        isGameOver = false;  // Ubah status game over menjadi false
    
        // Reset data player
        playerData = { health: 100, stamina: 100, hunger: 100 };
    
        hasWeapon = false;  
        ammo = { clip: 6, reserve: 36 };  // Reset ammo ke jumlah awal
    
        // Menghapus senjata yang ada
        if (weaponSprite) {
            weaponSprite.destroy();
            weaponSprite = null;
        }
    
        // Menghapus semua zombie dan loot
        zombies.clear(true, true);  // Menghapus semua zombie
        loot.clear(true, true);  // Menghapus semua loot
    
        // Menghentikan semua event atau timer yang berjalan
        scene.time.removeAllEvents();  // Menghapus semua event waktu yang berjalan
    
        // Restart scene untuk memulai ulang game
        if (scene.redOverlay) {
        scene.redOverlay.destroy();
        scene.redOverlay = null;
        }
        if (scene.greenOverlay) {
        scene.greenOverlay.destroy();
         scene.greenOverlay = null;
        } //perubahan 03
        
        if (scene.blueOverlay) {
            scene.blueOverlay.destroy();
            scene.blueOverlay = null;
        }
        


        if (deathSound && deathSound.isPlaying) {
        deathSound.stop();
        }
    
            scene.scene.restart();
            elapsedTime = 0;


      deathSound.setVolume(0.8); // Atur volume (0.1 - 1.0)

    }
function gameOver(scene) {
    isGameOver = true;

    if (deathSound) deathSound.play();

    scene.time.removeAllEvents();
    scene.physics.pause();
    player.setTint(0xff0000);

    const centerX = scene.cameras.main.centerX;
    const centerY = scene.cameras.main.centerY;

    const bgOverlay = scene.add.rectangle(centerX, centerY, scene.cameras.main.width, scene.cameras.main.height, 0x000000, 0.5)
        .setScrollFactor(0).setDepth(4);

    const gameOverText = scene.add.text(centerX, centerY - 50, 'Game Over', {
        fontSize: '48px', fill: '#fff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5);

    const timeSurvivedText = scene.add.text(centerX, centerY, 'Time Survived: ' + elapsedTime.toFixed(1) + ' sec', {
        fontSize: '32px', fill: '#fff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5);

    const retryButton = scene.add.text(centerX, centerY + 50, 'Retry', {
        fontSize: '32px', fill: '#fff', backgroundColor: '#000'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5).setPadding(10);

    // HANYA INI YANG BOLEH RESTART
    retryButton.setInteractive();
    retryButton.on('pointerdown', function () {
        if (deathSound && deathSound.isPlaying) {
            deathSound.stop();
        }

        // Reset data game di sini
        elapsedTime = 0;
        isGameOver = false;
        playerData = { health: 100, stamina: 100, hunger: 100 };
        hasWeapon = false;
        ammo = { clip: 6, reserve: 36 };
        if (weaponSprite) {
            weaponSprite.destroy();
            weaponSprite = null;
        }
        if (batuGroup) batuGroup.clear(true, true);
        batuGroup = spawnRandomDekorasi(scene, 'batu', 60, 90, 1.0, 1.3);
        


        // Clear overlays
        if (scene.redOverlay) scene.redOverlay.destroy();
        if (scene.greenOverlay) scene.greenOverlay.destroy();
        if (scene.blueOverlay) scene.blueOverlay.destroy();

        scene.scene.restart();
    });

    const mainMenuButton = scene.add.text(centerX, centerY + 110, 'Main Menu', {
        fontSize: '32px',
        fill: '#fff',
        backgroundColor: '#000'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5).setPadding(10).setInteractive();

    mainMenuButton.on('pointerdown', function () {
        window.location.href = 'index.html'; // Arahkan kembali ke main menu
    });
}


// === Tambahan fungsi baru untuk tembakan dari suara ===
function shootWeaponFromVoice() {
    var scene = player.scene;
    if (!scene) return;

    const laserLength = 200;
    const angleTolerance = 10;

    let laserDir = new Phaser.Math.Vector2(1, 0); // Default: arah kanan
    let minDistance = laserLength;
    let targetZombie = null;

    zombies.getChildren().forEach(function(zombie) {
        let zombieVec = new Phaser.Math.Vector2(zombie.x - player.x, zombie.y - player.y);
        let dist = zombieVec.length();
        if (dist <= laserLength) {
            let zombieDir = zombieVec.clone().normalize();
            let dot = laserDir.dot(zombieDir);
            let angleDiff = Phaser.Math.RadToDeg(Math.acos(dot));
            if (angleDiff < angleTolerance && dist < minDistance) {
                minDistance = dist;
                targetZombie = zombie;
            }
        }
    });

    if (targetZombie) {
        shootAtZombie(targetZombie);
    }

    // Tambahkan laser efek ke depan saat tembakan suara
    let endX = player.x + laserDir.x * laserLength;
    let endY = player.y + laserDir.y * laserLength;
    laserLine.lineStyle(2, 0xff0000, 1);
    laserLine.beginPath();
    laserLine.moveTo(player.x, player.y);
    laserLine.lineTo(endX, endY);
    laserLine.strokePath();

    if (shootSound) {
        shootSound.play();
    }
}

// === Ganti isi fungsi triggerShootAction agar gunakan fungsi di atas ===
function triggerShootAction() {
    if (hasWeapon && ammo.clip > 0 && (Date.now() - lastShotTime >= shotCooldown)) {
        lastShotTime = Date.now();
        shootWeapon(); // Gunakan fungsi shootWeapon yang sudah ada
        ammo.clip--;
        console.log("Shoot action triggered by VOICE, ammo left: " + ammo.clip);
        
        // Cancel reload jika sedang berlangsung
        cancelReload();
        
        // Visual feedback
        if (player.scene && !player.scene.voiceFeedback) {
            const scene = player.scene;
            scene.voiceFeedback = scene.add.text(
                player.x, player.y - 50, 
                "DOR!", 
                { 
                    fontSize: '24px', 
                    fill: '#ff0000', 
                    fontWeight: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            );
            scene.voiceFeedback.setOrigin(0.5);
            scene.voiceFeedback.setDepth(10);
            
            scene.tweens.add({
                targets: scene.voiceFeedback,
                y: player.y - 100,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    if (scene.voiceFeedback) {
                        scene.voiceFeedback.destroy();
                        scene.voiceFeedback = null;
                    }
                }
            });
        }
    } else {
        console.log("Voice trigger failed: no ammo or on cooldown");
    }
}

function cancelReload() {
    if (isReloading && !justCancelledReload) {
        isReloading = false;
        if (reloadTimer) {
            reloadTimer.remove();
            reloadTimer = null;
        }
        if (reloadSound && reloadSound.isPlaying) {
            reloadSound.stop();
        }

        justCancelledReload = true;
        setTimeout(() => {
            justCancelledReload = false;
        }, 100); // delay aman buat cegah spam 0.1 detik
    }
}

function shootAtZombie(zombie) {
    if (!zombie || !zombie.active) return;

    zombie.health -= weaponDamage;

    // 💥 Tambahan efek: ZOMBIE MERAH
    zombie.setTint(0xff0000); // jadi merah
    player.scene.time.delayedCall(100, () => {
        zombie.clearTint(); // balik ke normal setelah 100ms
    });

    // Kamera shake ringan
    zombie.scene.cameras.main.shake(100, 0.005);

    if (zombie.health <= 0) {
        // Zombie mati
        var dropChance = 0.3;
        if (Math.random() < dropChance) {
            var lootType = Phaser.Utils.Array.GetRandom(['medkit', 'energy', 'food']);
            var newLoot = loot.create(zombie.x, zombie.y, lootType);
            newLoot.lootType = lootType;
            newLoot.setDepth(1);
            newLoot.shadow = createShadow(player.scene, newLoot, 0.8);
        }

        if (zombie.shadow) zombie.shadow.destroy();
        zombie.destroy();
    }
}



function spawnRandomDekorasi(
    scene,
    textureKey,
    jumlah,
    minDistance = 80,
    scaleMin = 1.0,
    scaleMax = 1.3,
    rotMinDeg = 0,
    rotMaxDeg = 0,
    depth = -1
) {
    const group = scene.add.group();
    const posisiTerpakai = [];

    for (let i = 0; i < jumlah; i++) {
        let attempts = 0;
        let x, y;
        let terlaluDekat = true;

        while (terlaluDekat && attempts < 50) {
            x = Phaser.Math.Between(32, 2000 - 32);
            y = Phaser.Math.Between(32, 2000 - 32);

            terlaluDekat = posisiTerpakai.some(pos => {
                return Phaser.Math.Distance.Between(x, y, pos.x, pos.y) < minDistance;
            });

            attempts++;
        }

        if (terlaluDekat) continue;

        let obj = scene.add.image(x, y, textureKey);

        // Scale tetap atau acak
        let scale = Phaser.Math.FloatBetween(scaleMin, scaleMax);
        obj.setScale(scale);

        // Rotasi acak dalam derajat → radian
        let rotDeg = Phaser.Math.FloatBetween(rotMinDeg, rotMaxDeg);
        obj.setRotation(Phaser.Math.DegToRad(rotDeg));

        obj.setDepth(1);

        group.add(obj);
        posisiTerpakai.push({ x, y });
    }

    return group;
}

function restartVoiceRecognition() {
    if (speechRecognition) {
        try {
            speechRecognition.abort();
        } catch (_) {}
        isListening = false;
        setTimeout(() => {
            startListening();
        }, 200);
    }
}
