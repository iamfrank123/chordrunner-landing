/**
 * UIScene.js — Scena UI sovrapposta al canvas (Phaser overlay)
 *
 * Gestisce elementi grafici dentro Phaser che devono stare
 * sempre sopra al gameplay: trigger zone indicator, flash effetti.
 * Gira in parallelo con GameScene.
 */

class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    /* ── Eventuale altra UI di overlay Phaser può stare qui ── */
  }
}
