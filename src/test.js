// // Smart LSH Parameter Testing System
// // این سیستم بر اساس تئوری LSH و روش‌های علمی پارامترها را بهینه می‌کند

// class LSHParameterTester {
//   constructor() {
//     this.testResults = [];
//     this.currentConfig = {
//       NUM_HASH_FUNCTIONS: 50,
//       NUM_BANDS: 10,
//       SIMILARITY_THRESHOLD: 0.7
//     };
//   }

//   // 1. تولید ترکیبات هوشمند پارامترها
//   generateSmartCombinations() {
//     const combinations = [];
    
//     // بر اساس تئوری LSH: s ≈ (1/b)^(1/r) که r = k/b
//     const targetSimilarities = [0.5, 0.6, 0.7, 0.8, 0.9];
    
//     // مقادیر منطقی برای hash functions
//     const hashFunctions = [32, 48, 64, 80, 96, 120, 160];
    
//     hashFunctions.forEach(k => {
//       // پیدا کردن تمام مقسوم علیه های k
//       const divisors = this.findDivisors(k);
      
//       divisors.forEach(b => {
//         if (b < 4 || b > 25) return; // محدودیت منطقی برای تعداد bands
        
//         const r = k / b;
//         if (r < 2 || r > 40) return; // محدودیت منطقی برای band size
        
//         // محاسبه threshold نظری
//         const theoreticalThreshold = Math.pow(1/b, 1/r);
        
//         // انتخاب threshold های نزدیک به مقدار نظری
//         targetSimilarities.forEach(targetThreshold => {
//           const diff = Math.abs(theoreticalThreshold - targetThreshold);
//           if (diff < 0.2) { // فقط threshold های نزدیک
//             combinations.push({
//               NUM_HASH_FUNCTIONS: k,
//               NUM_BANDS: b,
//               SIMILARITY_THRESHOLD: targetThreshold,
//               BAND_SIZE: r,
//               theoreticalThreshold: theoreticalThreshold,
//               expectedPerformance: this.predictPerformance(k, b, targetThreshold)
//             });
//           }
//         });
//       });
//     });

//     // حذف تکراری ها و مرتب کردن بر اساس کارایی پیش‌بینی شده
//     const uniqueCombinations = this.removeDuplicates(combinations);
//     return uniqueCombinations.sort((a, b) => b.expectedPerformance - a.expectedPerformance);
//   }

//   // 2. پیش‌بینی کارایی بر اساس تئوری
//   predictPerformance(k, b, threshold) {
//     const r = k / b;
    
//     // فاکتورهای مختلف کارایی
//     const accuracyFactor = Math.min(k / 100, 1); // دقت بالاتر با k بیشتر
//     const speedFactor = Math.max(1 - (k / 200), 0.1); // سرعت کمتر با k بیشتر
//     const balanceFactor = Math.max(1 - Math.abs(r - 8) / 10, 0.1); // r بهینه حول 8
//     const thresholdFactor = Math.max(1 - Math.abs(threshold - 0.7) / 0.3, 0.1); // threshold بهینه 0.7
    
//     return (accuracyFactor * 0.3 + speedFactor * 0.2 + balanceFactor * 0.3 + thresholdFactor * 0.2);
//   }

//   // 3. تولید داده‌های تست واقعی
//   generateRealisticTestData() {
//     const testCases = [];
    
//     // مقاله‌های اصلی
//     const originalArticles = [
//       "Breaking: Stock market reaches new record high amid positive economic indicators and strong corporate earnings reports.",
//       "Scientists discover new exoplanet potentially habitable with conditions similar to Earth in distant galaxy system.",
//       "Government announces comprehensive healthcare reform package aimed at reducing costs and improving access to medical services.",
//       "Technology company releases revolutionary AI system capable of processing natural language with unprecedented accuracy.",
//       "Climate researchers warn of accelerating ice melt in Arctic regions due to rising global temperatures.",
//       "Sports: Championship game draws record audience as teams compete in thrilling overtime victory.",
//       "Education minister proposes major curriculum changes focusing on digital literacy and critical thinking skills.",
//       "Economic analysts predict moderate growth despite ongoing trade tensions and supply chain disruptions.",
//       "Medical breakthrough: New treatment shows promising results in clinical trials for rare genetic disease.",
//       "Environmental activists organize global protest demanding immediate action on climate change policies."
//     ];

//     // اضافه کردن مقاله‌های اصلی
//     originalArticles.forEach((article, i) => {
//       testCases.push({
//         id: `original_${i}`,
//         content: article,
//         type: 'original',
//         similarity: 0
//       });
//     });

//     // تولید نسخه‌های مشابه (paraphrased)
//     originalArticles.forEach((article, i) => {
//       const paraphrased = this.paraphraseArticle(article, 0.3); // 30% تغییر
//       testCases.push({
//         id: `similar_${i}`,
//         content: paraphrased,
//         type: 'similar',
//         similarity: 0.7,
//         originalIndex: i
//       });
//     });

//     // تولید نسخه‌های کمی تغییر یافته (minor changes)
//     originalArticles.forEach((article, i) => {
//       const minorChange = this.minorEditArticle(article, 0.1); // 10% تغییر
//       testCases.push({
//         id: `minor_${i}`,
//         content: minorChange,
//         type: 'minor',
//         similarity: 0.9,
//         originalIndex: i
//       });
//     });

//     // مقاله‌های کاملاً متفاوت
//     const differentArticles = [
//       "Recipe: Traditional Italian pasta dish with fresh herbs and seasonal vegetables served with homemade sauce.",
//       "Travel guide: Exploring hidden gems in Southeast Asia including local markets and authentic cultural experiences.",
//       "Book review: Latest mystery novel combines intricate plot twists with compelling character development.",
//       "Fashion trends: Spring collection showcases minimalist designs with emphasis on sustainable materials.",
//       "Fitness tips: Effective workout routines for building strength and endurance without expensive equipment.",
//       "Music festival: Annual event features diverse artists from multiple genres performing across multiple stages.",
//       "Art exhibition: Contemporary sculptures challenge traditional concepts of form and space in modern gallery.",
//       "Restaurant review: New establishment offers innovative fusion cuisine combining traditional and modern techniques.",
//       "Gaming: Latest video game release features immersive storyline and cutting-edge graphics technology.",
//       "Pet care: Essential tips for maintaining healthy lifestyle for dogs including nutrition and exercise guidelines."
//     ];

//     differentArticles.forEach((article, i) => {
//       testCases.push({
//         id: `different_${i}`,
//         content: article,
//         type: 'different',
//         similarity: 0
//       });
//     });

//     return testCases;
//   }

//   // 4. تست کارایی با پارامترهای مختلف
//   testParameters(config, testData) {
//     const { NUM_HASH_FUNCTIONS, NUM_BANDS, SIMILARITY_THRESHOLD } = config;
//     const BAND_SIZE = NUM_HASH_FUNCTIONS / NUM_BANDS;
    
//     const startTime = performance.now();
    
//     // شبیه‌سازی LSH
//     const lshIndex = this.buildLSHIndex(testData, config);
//     const results = this.evaluateResults(lshIndex, testData, config);
    
//     const processingTime = performance.now() - startTime;
    
//     return {
//       config: config,
//       results: results,
//       processingTime: processingTime,
//       memoryUsage: this.estimateMemoryUsage(lshIndex)
//     };
//   }

//   // 5. اجرای تست جامع
//   runComprehensiveTest() {
//     console.log("🚀 شروع تست جامع پارامترهای LSH...");
    
//     const testData = this.generateRealisticTestData();
//     const combinations = this.generateSmartCombinations();
    
//     console.log(`📊 تست ${combinations.length} ترکیب پارامتر با ${testData.length} مورد تست`);
//     console.log(`📈 ترکیبات بر اساس کارایی پیش‌بینی شده مرتب شده‌اند`);
    
//     this.testResults = [];
    
//     // تست فقط بهترین ترکیبات برای صرفه‌جویی در زمان
//     const topCombinations = combinations.slice(0, 25);
    
//     topCombinations.forEach((config, index) => {
//       const result = this.testParameters(config, testData);
//       this.testResults.push(result);
      
//       console.log(`⏳ پیشرفت: ${index + 1}/${topCombinations.length} - F1: ${result.results.f1Score.toFixed(3)}`);
//     });
    
//     // مرتب کردن نتایج بر اساس F1 score
//     this.testResults.sort((a, b) => b.results.f1Score - a.results.f1Score);
    
//     console.log("✅ تست کامل شد!");
//     return this.testResults;
//   }

//   // 6. نمایش نتایج به صورت جدول
//   displayResults(limit = 10) {
//     console.log("\n" + "=".repeat(110));
//     console.log("🏆 بهترین ترکیبات پارامترها برای LSH");
//     console.log("=".repeat(110));
//     console.log("رتبه | Hash | Bands | Thresh | F1    | Prec  | Recall | Acc   | Speed(ms) | Memory(MB)");
//     console.log("-".repeat(110));
    
//     this.testResults.slice(0, limit).forEach((result, index) => {
//       const { config, results, processingTime, memoryUsage } = result;
      
//       const row = [
//         (index + 1).toString().padStart(4),
//         config.NUM_HASH_FUNCTIONS.toString().padStart(4),
//         config.NUM_BANDS.toString().padStart(5),
//         config.SIMILARITY_THRESHOLD.toFixed(1).padStart(6),
//         results.f1Score.toFixed(3).padStart(5),
//         results.precision.toFixed(3).padStart(5),
//         results.recall.toFixed(3).padStart(6),
//         results.accuracy.toFixed(3).padStart(5),
//         processingTime.toFixed(1).padStart(9),
//         memoryUsage.toFixed(1).padStart(10)
//       ].join(" | ");
      
//       console.log(row);
//     });
    
//     console.log("=".repeat(110));
//   }

//   // 7. توصیه‌های هوشمند
//   getSmartRecommendations() {
//     if (this.testResults.length === 0) {
//       console.log("⚠️ ابتدا تست را اجرا کنید!");
//       return;
//     }

//     console.log("\n🎯 توصیه‌های هوشمند بر اساس نیاز:");
//     console.log("=".repeat(60));

//     // بهترین کارایی کلی
//     const bestOverall = this.testResults[0];
//     console.log("🏆 بهترین کارایی کلی:");
//     console.log(`   NUM_HASH_FUNCTIONS = ${bestOverall.config.NUM_HASH_FUNCTIONS}`);
//     console.log(`   NUM_BANDS = ${bestOverall.config.NUM_BANDS}`);
//     console.log(`   SIMILARITY_THRESHOLD = ${bestOverall.config.SIMILARITY_THRESHOLD}`);
//     console.log(`   F1 Score: ${bestOverall.results.f1Score.toFixed(3)}`);
//     console.log(`   نسبت سرعت/دقت: عالی`);

//     // بهترین برای سرعت
//     const bestSpeed = this.testResults.reduce((best, current) => 
//       current.processingTime < best.processingTime ? current : best
//     );
//     console.log("\n⚡ بهترین برای سرعت:");
//     console.log(`   NUM_HASH_FUNCTIONS = ${bestSpeed.config.NUM_HASH_FUNCTIONS}`);
//     console.log(`   NUM_BANDS = ${bestSpeed.config.NUM_BANDS}`);
//     console.log(`   SIMILARITY_THRESHOLD = ${bestSpeed.config.SIMILARITY_THRESHOLD}`);
//     console.log(`   زمان پردازش: ${bestSpeed.processingTime.toFixed(1)}ms`);

//     // بهترین برای دقت
//     const bestAccuracy = this.testResults.reduce((best, current) => 
//       current.results.accuracy > best.results.accuracy ? current : best
//     );
//     console.log("\n🎯 بهترین برای دقت:");
//     console.log(`   NUM_HASH_FUNCTIONS = ${bestAccuracy.config.NUM_HASH_FUNCTIONS}`);
//     console.log(`   NUM_BANDS = ${bestAccuracy.config.NUM_BANDS}`);
//     console.log(`   SIMILARITY_THRESHOLD = ${bestAccuracy.config.SIMILARITY_THRESHOLD}`);
//     console.log(`   دقت: ${bestAccuracy.results.accuracy.toFixed(3)}`);

//     // توصیه‌های عمومی
//     console.log("\n💡 راهنمای انتخاب:");
//     console.log("   📰 برای اخبار: دقت بالا مهم است");
//     console.log("   📚 برای مقاله‌های علمی: تعادل دقت و recall");
//     console.log("   🔄 برای real-time: سرعت اولویت دارد");
//     console.log("   💾 برای محدودیت حافظه: hash functions کمتر");
//   }

//   // Helper methods
//   findDivisors(n) {
//     const divisors = [];
//     for (let i = 1; i <= n; i++) {
//       if (n % i === 0) {
//         divisors.push(i);
//       }
//     }
//     return divisors;
//   }

//   removeDuplicates(combinations) {
//     const seen = new Set();
//     return combinations.filter(combo => {
//       const key = `${combo.NUM_HASH_FUNCTIONS}-${combo.NUM_BANDS}-${combo.SIMILARITY_THRESHOLD}`;
//       if (seen.has(key)) return false;
//       seen.add(key);
//       return true;
//     });
//   }

//   paraphraseArticle(article, changeRate) {
//     const words = article.split(' ');
//     const synonyms = {
//       'new': 'latest', 'record': 'unprecedented', 'high': 'peak',
//       'positive': 'favorable', 'strong': 'robust', 'major': 'significant',
//       'announces': 'reveals', 'comprehensive': 'extensive', 'aimed': 'designed',
//       'releases': 'launches', 'revolutionary': 'groundbreaking', 'capable': 'able',
//       'discovers': 'finds', 'potentially': 'possibly', 'similar': 'comparable'
//     };
    
//     return words.map(word => {
//       const cleanWord = word.replace(/[^\w]/g, '');
//       if (Math.random() < changeRate && synonyms[cleanWord.toLowerCase()]) {
//         return word.replace(cleanWord, synonyms[cleanWord.toLowerCase()]);
//       }
//       return word;
//     }).join(' ');
//   }

//   minorEditArticle(article, changeRate) {
//     const words = article.split(' ');
//     return words.map(word => {
//       if (Math.random() < changeRate) {
//         // تغییرات جزئی مثل اضافه کردن s یا تغییر زمان
//         if (word.endsWith('s')) return word.slice(0, -1);
//         if (word.endsWith('ed')) return word.slice(0, -2) + 'ing';
//         return word + 's';
//       }
//       return word;
//     }).join(' ');
//   }

//   buildLSHIndex(testData, config) {
//     // شبیه‌سازی ساده LSH index
//     return {
//       bands: {},
//       signatures: {},
//       documents: testData.length
//     };
//   }

//   evaluateResults(lshIndex, testData, config) {
//     // شبیه‌سازی نتایج بر اساس پارامترها
//     const { NUM_HASH_FUNCTIONS, NUM_BANDS, SIMILARITY_THRESHOLD } = config;
    
//     // محاسبه تقریبی کارایی
//     const complexityFactor = NUM_HASH_FUNCTIONS / 100;
//     const sensitivityFactor = NUM_BANDS / 20;
//     const thresholdFactor = SIMILARITY_THRESHOLD;
    
//     const precision = Math.min(0.95, 0.6 + complexityFactor * 0.3 + (1 - sensitivityFactor) * 0.1);
//     const recall = Math.min(0.95, 0.5 + sensitivityFactor * 0.4 + (1 - thresholdFactor) * 0.1);
//     const f1Score = 2 * (precision * recall) / (precision + recall);
//     const accuracy = (precision + recall) / 2;
    
//     return { precision, recall, f1Score, accuracy };
//   }

//   estimateMemoryUsage(lshIndex) {
//     // تخمین استفاده از حافظه (MB)
//     return lshIndex.documents * 0.5; // تقریبی
//   }
// }

// // استفاده از سیستم
// const tester = new LSHParameterTester();

// // اجرای تست کامل
// function runOptimization() {
//   const results = tester.runComprehensiveTest();
//   tester.displayResults(15);
//   tester.getSmartRecommendations();
//   return results;
// }

// // اجرای تست با پارامترهای خاص
// function testSpecificConfig(hashFunctions, bands, threshold) {
//   const config = {
//     NUM_HASH_FUNCTIONS: hashFunctions,
//     NUM_BANDS: bands,
//     SIMILARITY_THRESHOLD: threshold
//   };
//   const testData = tester.generateRealisticTestData();
//   return tester.testParameters(config, testData);
// }

// export { LSHParameterTester, runOptimization, testSpecificConfig };