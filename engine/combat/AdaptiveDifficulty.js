class AdaptiveDifficulty {
  constructor() {
    this.percentages = {
      TRIAD: 75,
      TENSION: 15,
      SUSPENDED: 10,
      SEVENTH: 0,
      NINTH: 0
    };

    this.categories = {
      TRIAD: ['', 'm'],
      TENSION: ['dim', 'aug'],
      SUSPENDED: ['sus2', 'sus4'],
      SEVENTH: ['maj7', 'm7', '7', 'm7b5'],
      NINTH: ['maj9', 'm9', '9']
    };

    this.categoryOrder = ['TRIAD', 'TENSION', 'SUSPENDED', 'SEVENTH', 'NINTH'];

    // Track stats over the minute
    this.batchStats = {
      TRIAD: { hits: 0, misses: 0 },
      TENSION: { hits: 0, misses: 0 },
      SUSPENDED: { hits: 0, misses: 0 },
      SEVENTH: { hits: 0, misses: 0 },
      NINTH: { hits: 0, misses: 0 }
    };

    this.startTime = Date.now();
    this.lastEvaluatedMinute = 0;
  }

  getChordCategory(chordKey) {
    if (!chordKey) return 'TRIAD'; // fallback
    for (const [cat, suffixes] of Object.entries(this.categories)) {
      if (suffixes.some(s => chordKey.endsWith(s))) return cat;
    }
    // More precise suffix match
    let suffix = '';
    // Roots can be C, C#, Db, etc. (1 or 2 chars).
    if (chordKey[1] === '#' || chordKey[1] === 'b') {
      suffix = chordKey.substring(2);
    } else {
      suffix = chordKey.substring(1);
    }

    for (const [cat, suffixes] of Object.entries(this.categories)) {
      if (suffixes.includes(suffix)) return cat;
    }

    return 'TRIAD';
  }

  recordHit(chordKey, isSuccess) {
    if (!chordKey) return;
    const cat = this.getChordCategory(chordKey);
    if (isSuccess) {
      this.batchStats[cat].hits++;
    } else {
      this.batchStats[cat].misses++;
    }

    const elapsedSecs = (Date.now() - this.startTime) / 1000;
    const currentMinute = Math.floor(elapsedSecs / 60);

    if (currentMinute > this.lastEvaluatedMinute) {
      this._processBatch(currentMinute);
      this.lastEvaluatedMinute = currentMinute;

      // Reset batch
      for (const key of Object.keys(this.batchStats)) {
        this.batchStats[key].hits = 0;
        this.batchStats[key].misses = 0;
      }
    }
  }

  _processBatch(currentMinute) {
    let allowedCategories = ['TRIAD', 'TENSION', 'SUSPENDED'];
    if (currentMinute >= 1) allowedCategories.push('SEVENTH'); // Minute 1+ 
    if (currentMinute >= 3) allowedCategories.push('NINTH');   // Minute 3+

    // Calculate net performance in this minute
    let netScore = 0;
    for (const cat of allowedCategories) {
      netScore += this.batchStats[cat].hits;
      netScore -= this.batchStats[cat].misses * 2;
    }

    if (netScore === 0) return;

    // Up to 12% shift per minute (much more gradual)
    let shiftAmt = Math.min(Math.abs(netScore) * 2, 12);

    // Order of difficulty
    const easyToHard = ['TRIAD', 'SUSPENDED', 'TENSION', 'SEVENTH', 'NINTH'].filter(c => allowedCategories.includes(c));
    const hardToEasy = [...easyToHard].reverse();

    const caps = { TRIAD: 50, TENSION: 40, SUSPENDED: 10, SEVENTH: 30, NINTH: 25 };

    if (netScore > 0) {
      // Player is good: Take from easiest, push to hardest
      let taken = 0;
      for (const cat of easyToHard) {
        if (taken >= shiftAmt) break;
        let available = this.percentages[cat] - 5; // leave floor of 5%
        if (available > 0) {
          let take = Math.min(available, shiftAmt - taken);
          this.percentages[cat] -= take;
          taken += take;
        }
      }

      let given = 0;
      for (const cat of hardToEasy) {
        if (given >= taken) break;
        let space = caps[cat] - this.percentages[cat];
        if (space > 0) {
          let give = Math.min(space, taken - given);
          this.percentages[cat] += give;
          given += give;
        }
      }
    } else {
      // Player is struggling: Take from hardest, push to easiest
      let taken = 0;
      for (const cat of hardToEasy) {
        if (taken >= shiftAmt) break;
        let available = this.percentages[cat] - 5;
        if (available > 0) {
          let take = Math.min(available, shiftAmt - taken);
          this.percentages[cat] -= take;
          taken += take;
        }
      }

      let given = 0;
      for (const cat of easyToHard) {
        if (given >= taken) break;
        let space = caps[cat] - this.percentages[cat];
        if (space > 0) {
          let give = Math.min(space, taken - given);
          this.percentages[cat] += give;
          given += give;
        }
      }
    }

    this._normalize(allowedCategories);
    console.log("Adaptive Difficulty Update (Directional):", this.percentages);
  }

  _normalize(allowedCategories) {
    // Constraint: each allowed category >= 5%
    for (const cat of allowedCategories) {
      if (this.percentages[cat] < 5) this.percentages[cat] = 5;
    }
    // Categories not allowed = 0
    for (const cat of this.categoryOrder) {
      if (!allowedCategories.includes(cat)) {
        this.percentages[cat] = 0;
      }
    }

    let sum = 0;
    for (const key of Object.keys(this.percentages)) {
      sum += this.percentages[key];
    }

    // Scale back to 100%
    if (sum !== 100 && sum > 0) {
      const f = 100 / sum;
      let newSum = 0;
      for (const key of Object.keys(this.percentages)) {
        this.percentages[key] = Math.round(this.percentages[key] * f);
        newSum += this.percentages[key];
      }

      // Fix rounding errors
      let diff = 100 - newSum;
      if (diff !== 0) {
        // Adjust the largest allowed category
        let largest = allowedCategories[0];
        for (const cat of allowedCategories) {
          if (this.percentages[cat] > this.percentages[largest]) largest = cat;
        }
        this.percentages[largest] += diff;
      }
    }
  }

  getChord(activeRoots) {
    const r = Phaser.Math.Between(1, 100);
    let cumulative = 0;
    let selectedCat = 'TRIAD';

    for (const cat of this.categoryOrder) {
      cumulative += this.percentages[cat];
      if (r <= cumulative) {
        selectedCat = cat;
        break;
      }
    }

    if (this.percentages[selectedCat] === 0) selectedCat = 'TRIAD'; // ultimate fallback

    const suffixes = this.categories[selectedCat];
    let suffix = suffixes[Phaser.Math.Between(0, suffixes.length - 1)];

    if (selectedCat === 'SEVENTH') {
      // 10% chance for m7b5, 30% for each of the other three (maj7, m7, 7)
      const r7 = Math.random();
      if (r7 < 0.10) suffix = 'm7b5';
      else if (r7 < 0.40) suffix = 'maj7';
      else if (r7 < 0.70) suffix = 'm7';
      else suffix = '7';
    }

    // pick random root
    let rootsArray = [];
    if (activeRoots === 'all') {
      rootsArray = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    } else {
      rootsArray = ['C', 'D', 'E', 'F', 'G', 'A', 'B']; // natural
    }

    const root = rootsArray[Phaser.Math.Between(0, rootsArray.length - 1)];
    return root + suffix;
  }

  getPercentages() {
    return this.percentages;
  }
}
