// در src/processArticle/metricsCollector.js
export class MetricsCollector {
  constructor() {
    this.articleMetrics = [];
    this.aggregate = {
      startTime: Date.now(),
      totalProcessed: 0,
      totalAccepted: 0,
      totalRejected: 0,
      rejectionBreakdown: { 
        lsh: 0, 
        document: 0, 
        paragraph: 0, 
        final: 0,
        storage_error: 0 
      },
      processingTimes: [],
      gasUsage: [],
      ipfsSizes: [],
      cacheGrowths: []
    };
  }

  recordArticle(articleId, result) {
    this.articleMetrics.push({ articleId, ...result });
    this.aggregate.totalProcessed++;
    
    if (result.accepted) {
      this.aggregate.totalAccepted++;
    } else {
      this.aggregate.totalRejected++;
      if (result.rejectionReason) {
        this.aggregate.rejectionBreakdown[result.rejectionReason] = 
          (this.aggregate.rejectionBreakdown[result.rejectionReason] || 0) + 1;
      }
    }

    if (result.processingTime) {
      this.aggregate.processingTimes.push(result.processingTime);
    }
    if (result.gasUsed && result.gasUsed !== '0') {
      this.aggregate.gasUsage.push(parseInt(result.gasUsed));
    }
    if (result.ipfsSize) {
      this.aggregate.ipfsSizes.push(result.ipfsSize);
    }
    if (result.cacheGrowth) {
      this.aggregate.cacheGrowths.push(result.cacheGrowth);
    }
  }

  getSummary() {
    const avg = (arr) => arr.length > 0 ? 
      arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    return {
      ...this.aggregate,
      endTime: Date.now(),
      totalDuration: Date.now() - this.aggregate.startTime,
      averages: {
        processingTime: avg(this.aggregate.processingTimes),
        gasUsed: avg(this.aggregate.gasUsage),
        ipfsSize: avg(this.aggregate.ipfsSizes),
        cacheGrowth: avg(this.aggregate.cacheGrowths)
      },
      totals: {
        processingTime: this.aggregate.processingTimes.reduce((a, b) => a + b, 0),
        gasUsed: this.aggregate.gasUsage.reduce((a, b) => a + b, 0),
        ipfsSize: this.aggregate.ipfsSizes.reduce((a, b) => a + b, 0),
        cacheGrowth: this.aggregate.cacheGrowths.reduce((a, b) => a + b, 0)
      },
      acceptanceRate: this.aggregate.totalProcessed > 0 ? 
        (this.aggregate.totalAccepted / this.aggregate.totalProcessed * 100).toFixed(2) + '%' : '0%'
    };
  }

  printSummary() {
    const summary = this.getSummary();
    console.log('\n' + '='.repeat(60));
    console.log('📊 AGGREGATE METRICS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Articles Processed: ${summary.totalProcessed}`);
    console.log(`Accepted: ${summary.totalAccepted} (${summary.acceptanceRate})`);
    console.log(`Rejected: ${summary.totalRejected}`);
    console.log('Rejection Reasons:', summary.rejectionBreakdown);
    console.log(`Average Processing Time: ${summary.averages.processingTime.toFixed(0)} ms`);
    console.log(`Average IPFS Size: ${(summary.averages.ipfsSize / 1024).toFixed(2)} KB`);
    console.log(`Average Gas Used: ${summary.averages.gasUsed.toFixed(0)}`);
    console.log(`Total Cache Growth: ${(summary.totals.cacheGrowth / 1024).toFixed(2)} KB`);
    console.log(`Total Duration: ${(summary.totalDuration / 1000).toFixed(2)} seconds`);
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('metricsCollector', JSON.stringify({
        articleMetrics: this.articleMetrics,
        aggregate: this.aggregate
      }));
    } catch (e) {
      console.warn('Could not save metrics to localStorage:', e.message);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('metricsCollector');
      if (saved) {
        const data = JSON.parse(saved);
        this.articleMetrics = data.articleMetrics || [];
        this.aggregate = data.aggregate || this.aggregate;
      }
    } catch (e) {
      console.warn('Could not load metrics from localStorage:', e.message);
    }
  }

  clear() {
    this.articleMetrics = [];
    this.aggregate = {
      startTime: Date.now(),
      totalProcessed: 0,
      totalAccepted: 0,
      totalRejected: 0,
      rejectionBreakdown: { lsh: 0, document: 0, paragraph: 0, final: 0, storage_error: 0 },
      processingTimes: [],
      gasUsage: [],
      ipfsSizes: [],
      cacheGrowths: []
    };
    localStorage.removeItem('metricsCollector');
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Global fallback
window.globalArticleMetrics = window.globalArticleMetrics || [];