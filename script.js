class RecruitReadyAnalyzer {
    constructor() {
        this.resumeText = '';
        this.jobDescription = '';
        this.keywordWeights = {
            technical: 3,
            skills: 2.5,
            experience: 2,
            education: 1.5,
            general: 1
        };
        // Advanced project detection patterns
        this.projectPatterns = {
            ongoing: /(?:currently|present|ongoing|developing|building|working on|jan 2026.*present)/i,
            metrics: /(?:users?|accuracy|performance|records?\/?s(?:ec)?|latency|<\d+s|\d+\+?%|\d+\+?\s+users?)/i,
            technical: /(?:tf-idf|ai|ml|nlp|api|rest|deployment|production|real-time|system)/i
        };
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File upload handlers
        const resumeInput = document.getElementById('resumeInput');
        const resumeDropArea = document.getElementById('resumeDropArea');
        const browseLink = resumeDropArea.querySelector('.browse-link');
        const jobDescTextarea = document.getElementById('jobDescription');
        const resumeTextArea = document.getElementById('resumeTextArea');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const generateCoverLetterBtn = document.getElementById('generateCoverLetterBtn');

        // Browse files click
        browseLink.addEventListener('click', () => resumeInput.click());

        // File input change
        resumeInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0]));

        // Drag and drop
        resumeDropArea.addEventListener('dragover', this.handleDragOver.bind(this));
        resumeDropArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        resumeDropArea.addEventListener('drop', this.handleDrop.bind(this));

        // Job description input
        jobDescTextarea.addEventListener('input', this.checkInputs.bind(this));
        
        // Resume text area input
        resumeTextArea.addEventListener('input', (e) => {
            this.resumeText = e.target.value;
            
            // Update UI to show text input is being used
            const resumeInfo = document.getElementById('resumeInfo');
            if (this.resumeText.length > 0) {
                resumeInfo.innerHTML = `<strong>📝 Text Input</strong><br><small>${this.resumeText.length} characters entered</small>`;
                resumeInfo.style.display = 'block';
            } else {
                resumeInfo.style.display = 'none';
            }
            
            this.checkInputs();
        });

        // Analyze button
        analyzeBtn.addEventListener('click', this.analyzeMatch.bind(this));

        // Cover letter generation
        generateCoverLetterBtn.addEventListener('click', this.generateCoverLetter.bind(this));

        // Mode toggle
        document.getElementById('aiModeToggle').addEventListener('change', this.toggleAIMode.bind(this));
        
        // API key management
        document.getElementById('saveApiKey').addEventListener('click', this.saveApiKey.bind(this));
        
        // Cover letter actions  
        document.getElementById('copyLetter').addEventListener('click', this.copyLetter.bind(this));
        document.getElementById('regenerateLetter').addEventListener('click', this.regenerateLetter.bind(this));
        document.getElementById('editLetter').addEventListener('click', this.toggleEditMode.bind(this));
        document.getElementById('downloadLetter').addEventListener('click', this.downloadLetter.bind(this));
        document.getElementById('coverLetterText').addEventListener('input', this.updateLetterStats.bind(this));
        
        // Load saved API key
        this.loadSavedApiKey();
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('resumeDropArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('resumeDropArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('resumeDropArea').classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        this.handleFileUpload(file);
    }

    async handleFileUpload(file) {
        if (!file) return;

        const allowedTypes = ['text/plain', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.some(type => file.type.includes(type) || file.name.toLowerCase().endsWith('.pdf'))) {
            this.showNotification('Please upload a PDF or text file', 'error');
            return;
        }

        if (file.size > maxSize) {
            this.showNotification('File size must be less than 5MB', 'error');
            return;
        }

        try {
            // Show loading message
            const resumeInfo = document.getElementById('resumeInfo');
            resumeInfo.innerHTML = `<div class="loading-text">📄 Extracting text from ${file.name}...</div>`;
            resumeInfo.style.display = 'block';

            const text = await this.extractTextFromFile(file);
            this.resumeText = text;

            // Update UI
            resumeInfo.innerHTML = `
                <strong>📄 ${file.name}</strong><br>
                <small>Size: ${(file.size / 1024).toFixed(1)} KB | Characters: ${text.length}</small>
            `;

            this.showNotification('Resume text extracted successfully!', 'success');
            this.checkInputs();
        } catch (error) {
            this.showNotification('Error extracting text from file. Please try again.', 'error');
            console.error('File upload error:', error);
        }
    }

    async extractTextFromFile(file) {
        if (file.type === 'text/plain') {
            return await file.text();
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            return await this.extractTextFromPdf(file);
        }
        throw new Error('Unsupported file type');
    }

    async extractTextFromPdf(file) {
        try {
            // Check if PDF.js is available
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js library not loaded. Please refresh the page and try again.');
            }

            // Set PDF.js worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let textContent = '';
            
            // Extract text from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContentObj = await page.getTextContent();
                
                const pageText = textContentObj.items
                    .map(item => item.str)
                    .join(' ');
                
                textContent += pageText + '\n';
            }
            
            if (textContent.trim().length === 0) {
                throw new Error('No text found in PDF. The PDF might be image-based or password protected.');
            }
            
            return textContent.trim();
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    checkInputs() {
        const jobDesc = document.getElementById('jobDescription').value.trim();
        const analyzeBtn = document.getElementById('analyzeBtn');

        const hasResume = this.resumeText.length > 0;
        const hasJobDesc = jobDesc.length > 50;

        analyzeBtn.disabled = !(hasResume && hasJobDesc);

        if (hasJobDesc) {
            this.jobDescription = jobDesc;
        }
    }

    analyzeMatch() {
        if (!this.resumeText || !this.jobDescription) {
            this.showNotification('Please upload your resume and enter the job description', 'error');
            return;
        }

        // Show results section
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });

        // Use advanced TF-IDF based matching
        const analysis = this.performAdvancedMatching();
        this.displayResults(analysis);
        this.generateEnhancedRecommendations(analysis);
    }

    performAdvancedMatching() {
        // Clean and preprocess text
        const cleanedResume = this.cleanText(this.resumeText);
        const cleanedJobDesc = this.cleanText(this.jobDescription);
        
        // Extract technical keywords from both texts with position-based weighting
        const resumeKeywords = this.extractKeywords(this.resumeText);
        const jobAnalysis = this.extractJobKeywordsWithWeighting(this.jobDescription);
        const jobKeywords = jobAnalysis.keywords;
        
        // Create vocabulary from both texts
        const vocabulary = this.createVocabulary([cleanedResume, cleanedJobDesc]);
        
        // Calculate TF-IDF vectors
        const resumeVector = this.calculateTFIDF(cleanedResume, vocabulary);
        const jobVector = this.calculateTFIDF(cleanedJobDesc, vocabulary);
        
        // Calculate cosine similarity
        const cosineSimilarity = this.calculateCosineSimilarity(resumeVector, jobVector);
        
        // Enhanced keyword analysis
        const keywordAnalysis = this.analyzeKeywordOverlap(resumeKeywords, jobKeywords, jobAnalysis);
        
        // Combine cosine similarity with keyword matching for final score
        const combinedScore = this.calculateCombinedScore(cosineSimilarity, keywordAnalysis);
        
        return {
            matchScore: Math.round(combinedScore * 100),
            cosineSimilarity: Math.round(cosineSimilarity * 100),
            keywordMatchScore: Math.round(keywordAnalysis.matchPercentage * 100),
            jobKeywords: jobKeywords,
            resumeKeywords: resumeKeywords,
            foundKeywords: keywordAnalysis.foundKeywords,
            missingKeywords: keywordAnalysis.missingKeywords,
            topMatchingTerms: this.getTopMatchingTerms(resumeVector, jobVector, vocabulary),
        };
    }

    cleanText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    createVocabulary(documents) {
        const vocabulary = new Set();
        const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'a', 'an']);
        
        documents.forEach(doc => {
            const words = doc.split(' ').filter(word => 
                word.length > 2 && 
                !stopWords.has(word) && 
                /^[a-z]+$/.test(word)
            );
            words.forEach(word => vocabulary.add(word));
        });
        
        return Array.from(vocabulary).sort();
    }

    calculateTFIDF(document, vocabulary) {
        const words = document.split(' ');
        const wordCount = {};
        const totalWords = words.length;
        
        // Calculate term frequency (TF)
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        // Create TF-IDF vector
        const vector = vocabulary.map(term => {
            const tf = (wordCount[term] || 0) / totalWords;
            // Simplified IDF (for demo purposes - in production, calculate across corpus)
            const idf = Math.log(2 / (1 + (wordCount[term] ? 1 : 0)));
            return tf * idf;
        });
        
        return vector;
    }

    calculateCosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    analyzeKeywordOverlap(resumeKeywords, jobKeywords, jobAnalysis) {
        const foundKeywords = [];
        const missingKeywords = [];
        const partialMatches = [];

        jobKeywords.forEach(jobKeyword => {
            let found = false;
            let partialMatch = false;

            resumeKeywords.forEach(resumeKeyword => {
                const similarity = this.calculateStringSimilarity(
                    jobKeyword.toLowerCase(), 
                    resumeKeyword.toLowerCase()
                );
                
                if (similarity > 0.8) {
                    found = true;
                    foundKeywords.push(jobKeyword);
                } else if (similarity > 0.6) {
                    partialMatch = true;
                    partialMatches.push({
                        job: jobKeyword,
                        resume: resumeKeyword,
                        similarity
                    });
                }
            });

            if (!found && !partialMatch) {
                missingKeywords.push(jobKeyword);
            }
        });

        // Use exact ATS formula: (|JD keywords ∩ Resume keywords| / |JD keywords|) × 100
        const matchPercentage = foundKeywords.length / Math.max(jobKeywords.length, 1);
        
        // Sort missing keywords by priority (position-based weighting)
        const prioritizedMissingKeywords = this.prioritizeMissingKeywords(missingKeywords, jobAnalysis);

        return {
            foundKeywords,
            missingKeywords: prioritizedMissingKeywords,
            partialMatches,
            matchPercentage
        };
    }

    calculateStringSimilarity(str1, str2) {
        // Levenshtein distance-based similarity
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        const maxLength = Math.max(str1.length, str2.length);
        return (maxLength - matrix[str2.length][str1.length]) / maxLength;
    }

    calculateCombinedScore(cosineSimilarity, keywordAnalysis) {
        // Enhanced ATS-optimized scoring: 70% keyword + 30% semantic (matching RecruitReady methodology)
        // This mirrors how modern ATS systems with AI capabilities prioritize exact matches while considering context
        const keywordScore = keywordAnalysis.matchPercentage * 0.7;
        const semanticScore = cosineSimilarity * 0.3;
        
        // Additional boost for high-priority technical keywords
        const technicalBoost = this.calculateTechnicalBoost(keywordAnalysis.foundKeywords) * 0.05;
        
        return Math.min(keywordScore + semanticScore + technicalBoost, 1.0);
    }

    calculateTechnicalBoost(foundKeywords) {
        const technicalKeywords = ['python', 'sql', 'javascript', 'react', 'node.js', 'aws', 'docker', 'kubernetes', 
                                 'machine learning', 'ai', 'data science', 'api', 'rest', 'microservices', 'kafka', 'postgresql'];
        const foundTechnical = foundKeywords.filter(keyword => 
            technicalKeywords.some(tech => keyword.toLowerCase().includes(tech.toLowerCase())));
        
        return Math.min(foundTechnical.length / 5, 1.0); // Max 5 technical keywords for full boost
    }

    getTopMatchingTerms(resumeVector, jobVector, vocabulary) {
        const matchingTerms = [];
        
        for (let i = 0; i < vocabulary.length; i++) {
            if (resumeVector[i] > 0 && jobVector[i] > 0) {
                matchingTerms.push({
                    term: vocabulary[i],
                    relevance: resumeVector[i] * jobVector[i]
                });
            }
        }
        
        return matchingTerms
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 10)
            .map(item => item.term);
    }

    extractJobKeywordsWithWeighting(jobText) {
        // Detect important sections in job description
        const sections = this.identifyJobSections(jobText);
        const allKeywords = this.extractKeywords(jobText);
        
        // Create weighted keywords based on section importance
        const weightedKeywords = allKeywords.map(keyword => ({
            keyword,
            weight: this.calculateKeywordWeight(keyword, sections),
            section: this.findKeywordSection(keyword, sections)
        }));
        
        return {
            keywords: allKeywords,
            weightedKeywords,
            sections
        };
    }

    identifyJobSections(jobText) {
        const sections = {
            requirements: { weight: 3.0, content: '', keywords: [] },
            qualifications: { weight: 2.8, content: '', keywords: [] },
            responsibilities: { weight: 2.0, content: '', keywords: [] },
            skills: { weight: 2.5, content: '', keywords: [] },
            experience: { weight: 2.2, content: '', keywords: [] },
            other: { weight: 1.0, content: '', keywords: [] }
        };
        
        const lines = jobText.split('\n');
        let currentSection = 'other';
        
        lines.forEach(line => {
            const lowerLine = line.toLowerCase().trim();
            
            // Detect section headers
            if (lowerLine.includes('requirement') || lowerLine.includes('must have')) {
                currentSection = 'requirements';
            } else if (lowerLine.includes('qualification') || lowerLine.includes('preferred')) {
                currentSection = 'qualifications';
            } else if (lowerLine.includes('responsibilit') || lowerLine.includes('duties')) {
                currentSection = 'responsibilities';
            } else if (lowerLine.includes('skill') || lowerLine.includes('technical')) {
                currentSection = 'skills';
            } else if (lowerLine.includes('experience') || lowerLine.includes('years')) {
                currentSection = 'experience';
            }
            
            sections[currentSection].content += line + '\n';
        });
        
        // Extract keywords from each section
        Object.keys(sections).forEach(sectionName => {
            if (sections[sectionName].content.trim()) {
                sections[sectionName].keywords = this.extractKeywords(sections[sectionName].content);
            }
        });
        
        return sections;
    }

    calculateKeywordWeight(keyword, sections) {
        let maxWeight = 1.0;
        
        Object.entries(sections).forEach(([sectionName, section]) => {
            if (section.keywords.some(k => 
                k.toLowerCase() === keyword.toLowerCase() ||
                k.toLowerCase().includes(keyword.toLowerCase()) ||
                keyword.toLowerCase().includes(k.toLowerCase())
            )) {
                maxWeight = Math.max(maxWeight, section.weight);
            }
        });
        
        return maxWeight;
    }

    findKeywordSection(keyword, sections) {
        for (const [sectionName, section] of Object.entries(sections)) {
            if (section.keywords.some(k => 
                k.toLowerCase() === keyword.toLowerCase() ||
                k.toLowerCase().includes(keyword.toLowerCase()) ||
                keyword.toLowerCase().includes(k.toLowerCase())
            )) {
                return sectionName;
            }
        }
        return 'other';
    }

    prioritizeMissingKeywords(missingKeywords, jobAnalysis) {
        if (!jobAnalysis.weightedKeywords) return missingKeywords;
        
        // Create a map of keywords to their weights
        const keywordWeights = new Map();
        jobAnalysis.weightedKeywords.forEach(item => {
            keywordWeights.set(item.keyword.toLowerCase(), {
                weight: item.weight,
                section: item.section
            });
        });
        
        // Sort missing keywords by weight (highest first)
        return missingKeywords.sort((a, b) => {
            const weightA = keywordWeights.get(a.toLowerCase())?.weight || 1.0;
            const weightB = keywordWeights.get(b.toLowerCase())?.weight || 1.0;
            return weightB - weightA;
        }).map(keyword => {
            const info = keywordWeights.get(keyword.toLowerCase());
            return {
                keyword,
                weight: info?.weight || 1.0,
                section: info?.section || 'other',
                priority: this.getKeywordPriorityLabel(info?.weight || 1.0)
            };
        });
    }

    getKeywordPriorityLabel(weight) {
        if (weight >= 2.8) return 'Critical';
        if (weight >= 2.2) return 'High';
        if (weight >= 1.5) return 'Medium';
        return 'Low';
    }

    performKeywordAnalysis() {
        // Extract keywords from job description
        const jobKeywords = this.extractKeywords(this.jobDescription);
        const resumeKeywords = this.extractKeywords(this.resumeText);

        // Normalize text for better matching
        const resumeText = this.resumeText.toLowerCase();
        const jobText = this.jobDescription.toLowerCase();

        // Find matches with improved algorithm
        const foundKeywords = [];
        const missingKeywords = [];

        jobKeywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            let found = false;

            // Check direct match in resume text
            if (resumeText.includes(keywordLower)) {
                found = true;
            }

            // Check if resume has similar keywords
            if (!found) {
                found = resumeKeywords.some(rKeyword => {
                    const rKeywordLower = rKeyword.toLowerCase();
                    return (
                        rKeywordLower.includes(keywordLower) ||
                        keywordLower.includes(rKeywordLower) ||
                        this.areKeywordsSimilar(keywordLower, rKeywordLower)
                    );
                });
            }

            // Check for variations and synonyms
            if (!found) {
                found = this.checkKeywordVariations(keywordLower, resumeText);
            }

            if (found) {
                foundKeywords.push(keyword);
            } else {
                missingKeywords.push(keyword);
            }
        });

        // Calculate match score with weighted importance
        const importantKeywords = this.getImportantKeywords(jobKeywords);
        const foundImportant = foundKeywords.filter(k => importantKeywords.includes(k.toLowerCase()));
        const matchScore = Math.round((foundKeywords.length / jobKeywords.length) * 70 + (foundImportant.length / importantKeywords.length) * 30);

        return {
            jobKeywords,
            resumeKeywords,
            foundKeywords,
            missingKeywords,
            matchScore: Math.min(matchScore, 100)
        };
    }

    extractKeywords(text) {
        // Focus only on job-critical technical skills and qualifications
        const technicalKeywords = new Set();

        // Core technical skill categories
        const keywordCategories = {
            // Programming languages
            programmingLanguages: /\b(JavaScript|JS|Python|Java|C\+\+|C#|CSharp|TypeScript|TS|PHP|Ruby|Go|Rust|Swift|Kotlin|Scala|R|MATLAB|Perl|C\b|C language)\b/gi,
            
            // Frameworks and libraries
            frameworks: /\b(React|ReactJS|Angular|AngularJS|Vue|VueJS|Node\.js|NodeJS|Express|Django|Flask|Spring|SpringBoot|SpringFramework|Laravel|Rails|jQuery|Bootstrap|TailwindCSS|NextJS|NuxtJS|TensorFlow|PyTorch|scikit-learn|Keras|Pandas|NumPy|Hugging Face|HuggingFace|Ray|SparkML|Spark ML|MLflow|Apache Spark|OpenCV|CUDA|cuDNN)\b/gi,
            
            // Databases
            databases: /\b(MySQL|PostgreSQL|Postgres|MongoDB|Mongo|Redis|SQLite|Oracle|SQL Server|MSSQL|DynamoDB|Cassandra|Neo4j|InfluxDB|SQL|NoSQL|Database)\b/gi,
            
            // Cloud platforms
            cloudPlatforms: /\b(AWS|Amazon Web Services|Azure|Microsoft Azure|Google Cloud|GCP|DigitalOcean|Heroku|Vercel|Netlify|Cloud Computing)\b/gi,
            
            // DevOps and tools
            devOpsTools: /\b(Docker|Kubernetes|K8s|Jenkins|Git|GitHub|GitLab|Bitbucket|CI\/CD|Terraform|Ansible|Chef|Puppet|Helm|Maven|Gradle|NPM|Yarn|Webpack|Vite)\b/gi,
            
            // Development methodologies
            methodologies: /\b(Agile|Scrum|Kanban|DevOps|TDD|Test[\s\-]?Driven Development|BDD|Microservices|SOA|SOLID|Research Methodology)\b/gi,
            
            // Web and API technologies
            webTechnologies: /\b(REST|RESTful|GraphQL|API|HTML|HTML5|CSS|CSS3|SASS|SCSS|JSON|XML|HTTP|HTTPS|WebSocket|OAuth|JWT)\b/gi,
            
            // Development tools and IDEs
            developmentTools: /\b(Visual Studio Code|VSCode|IntelliJ|Eclipse|Sublime|Atom|Vim|Emacs|Tomcat|Apache|Nginx|Postman|Swagger|Jupyter|PyCharm)\b/gi,
            
            // Operating systems and environments
            systems: /\b(Linux|Windows|MacOS|Ubuntu|CentOS|Unix|Shell|Bash|PowerShell)\b/gi,
            
            // AI/ML and Research domains (Enhanced for research positions)
            aiMLDomains: /\b(Machine Learning|ML|AI|Artificial Intelligence|Data Science|Deep Learning|Computer Vision|NLP|Natural Language Processing|Information Retrieval|LLMs|Large Language Models|Agent Systems|Context Engineering|ML Architecture|Statistical Modeling|Data Analytics|Big Data|Neural Networks|CNN|RNN|LSTM|GAN|Transformer|BERT|GPT|Computer Graphics|3D Reconstruction|Object Detection|Image Segmentation|Speech Recognition|Robotics|Reinforcement Learning|Supervised Learning|Unsupervised Learning|Semi[\s\-]?supervised Learning|Transfer Learning|Few[\s\-]?shot Learning|Zero[\s\-]?shot Learning)\b/gi,
            
            // Research and Academic Skills
            researchSkills: /\b(Research|PhD|Doctorate|Post[\s\-]?doc|Publication|Paper|Conference|CVPR|ECCV|ICCV|NeurIPS|ICML|ICLR|ACL|EMNLP|SIGGRAPH|Patent|Grant|Fellowship|Peer[\s\-]?review|Literature Review|Experimental Design|Statistical Analysis|Hypothesis Testing|Data Analysis|Prototype|Algorithm Design|Mathematical Modeling)\b/gi,
            
            // Testing frameworks and tools
            testing: /\b(Jest|Mocha|Jasmine|Cypress|Selenium|Playwright|JUnit|TestNG|PyTest|QA|Quality Assurance|Unit Testing|Integration Testing|E2E)\b/gi,
            
            // Education and certifications (Enhanced for research positions)
            education: /\b(Bachelor|Bachelor's|Master|Master's|PhD|Doctorate|Computer Science|CS|Software Engineering|Information Technology|IT|Certification|Certified|AWS Certified|Azure Certified|Research Scientist|Postdoc|Graduate|Undergraduate)\b/g,
            
            // Essential soft skills and job titles
            softSkillsAndTitles: /\b(Software Engineer|Research Scientist|Data Scientist|ML Engineer|AI Engineer|Leadership|Project Management|Team Lead|Technical Lead|Architect|Problem[\s\-]?solving|Communication|Mentoring|Decision[\s\-]?making|Algorithms|Algorithm Design|Cross[\s\-]?functional|Collaboration|Innovation)\b/gi
        };

        // Extract keywords from each category
        Object.values(keywordCategories).forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const cleaned = match.trim().replace(/[\s\-]+/g, ' ');
                    // Special handling for IT vs it
                    if (cleaned.toLowerCase() === 'it' && cleaned !== 'IT') {
                        return; // Skip lowercase 'it'
                    }
                    technicalKeywords.add(cleaned);
                });
            }
        });

        // Add specific job-critical terms that appear in context
        const specificTechnicalTerms = [
            'Microservices', 'Full Stack', 'Frontend', 'Backend', 'API Development',
            'Database Design', 'System Architecture', 'Performance Optimization',
            'Code Review', 'Version Control', 'Continuous Integration', 'Deployment',
            'Scalability', 'Security', 'Authentication', 'Authorization',
            'Data Pipelines', 'ML Systems', 'Agent Orchestration', 'A2A Communication',
            'Runtime Performance', 'Optimization', 'Statistical Analysis', 'Algorithms',
            'Algorithm Design', 'Decision Making', 'Software Engineer', 'Research Scientist',
            'Data Scientist', 'ML Engineer', 'AI Engineer', 'Computer Graphics',
            '3D Reconstruction', 'Object Detection', 'Image Segmentation', 'Speech Recognition',
            'Reinforcement Learning', 'Neural Networks', 'Cross Functional', 'Open Source',
            'Research Publications', 'Peer Review', 'Experimental Design', 'Prototype Development',
            '2D Localization', '3D Localization', 'Object Tracking', '3D Pose Estimation',
            'Egocentric Vision', 'Vision Language Models', 'Representation Learning',
            'Grounded Understanding', 'Multimedia Perception', 'Semantic Understanding'
        ];

        specificTechnicalTerms.forEach(term => {
            if (text.toLowerCase().includes(term.toLowerCase())) {
                // Special handling for IT vs it
                if (term.toLowerCase() === 'it') {
                    // Only add if we find 'IT' in uppercase in the original text
                    if (text.includes('IT')) {
                        technicalKeywords.add('IT');
                    }
                } else {
                    technicalKeywords.add(term);
                }
            }
        });

        return Array.from(technicalKeywords).slice(0, 40); // Focused list of max 40 technical keywords
    }

    areKeywordsSimilar(keyword1, keyword2) {
        // Check for common variations and abbreviations
        const variations = {
            'javascript': ['js', 'ecmascript'],
            'js': ['javascript', 'ecmascript'],
            'typescript': ['ts'],
            'ts': ['typescript'],
            'css': ['css3', 'cascading style sheets'],
            'html': ['html5', 'hypertext markup language'],
            'sql': ['structured query language', 'database'],
            'nosql': ['no sql', 'non sql'],
            'api': ['application programming interface'],
            'rest': ['restful', 'rest api', 'restful api'],
            'ci/cd': ['continuous integration', 'continuous deployment'],
            'devops': ['dev ops', 'development operations'],
            'ml': ['machine learning'],
            'ai': ['artificial intelligence'],
            'cs': ['computer science'],
            'it': ['information technology'],
            'frontend': ['front end', 'front-end'],
            'backend': ['back end', 'back-end'],
            'fullstack': ['full stack', 'full-stack'],
            'ui': ['user interface'],
            'ux': ['user experience'],
            'qa': ['quality assurance'],
            'tdd': ['test driven development', 'test-driven development']
        };

        // Check if keywords are variations of each other
        if (variations[keyword1] && variations[keyword1].includes(keyword2)) {
            return true;
        }
        if (variations[keyword2] && variations[keyword2].includes(keyword1)) {
            return true;
        }

        // Check for partial matches with common endings
        const endings = ['ing', 'ed', 's', 'er', 'ly'];
        for (let ending of endings) {
            if (keyword1.endsWith(ending) && keyword2 === keyword1.slice(0, -ending.length)) {
                return true;
            }
            if (keyword2.endsWith(ending) && keyword1 === keyword2.slice(0, -ending.length)) {
                return true;
            }
        }

        // Check for similar length and character overlap
        if (Math.abs(keyword1.length - keyword2.length) <= 2) {
            const similarity = this.calculateSimilarity(keyword1, keyword2);
            return similarity > 0.8; // 80% similarity threshold
        }

        return false;
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    checkKeywordVariations(keyword, resumeText) {
        // Check for different forms and contexts
        const patterns = [
            new RegExp(`\\b${keyword}\\b`, 'i'),
            new RegExp(`\\b${keyword}s\\b`, 'i'), // plural
            new RegExp(`\\b${keyword}ed\\b`, 'i'), // past tense
            new RegExp(`\\b${keyword}ing\\b`, 'i'), // present participle
            new RegExp(`${keyword}`, 'i') // partial match
        ];

        return patterns.some(pattern => pattern.test(resumeText));
    }

    getImportantKeywords(keywords) {
        // Define job-critical keywords that significantly impact matching
        const jobCritical = [
            // Core programming languages
            'java', 'javascript', 'js', 'python', 'typescript', 'ts', 'c#', 'c++',
            // Major frameworks that define role requirements
            'spring', 'springboot', 'react', 'angular', 'vue', 'nodejs', 'django', 'flask',
            // ML/AI frameworks (critical for ML roles)
            'tensorflow', 'pytorch', 'scikit-learn', 'hugging face', 'ray', 'sparkml',
            // Essential cloud platforms (often job requirements)
            'aws', 'amazon web services', 'azure', 'microsoft azure', 'google cloud', 'gcp',
            // Critical development practices
            'agile', 'scrum', 'devops', 'git', 'ci/cd', 'docker', 'kubernetes',
            // API and web service technologies
            'rest', 'restful', 'api', 'graphql', 'microservices',
            // Database technologies (usually required)
            'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'nosql',
            // Educational requirements
            'bachelor', 'master', 'computer science', 'cs', 'software engineering',
            // Leadership skills (for senior roles)
            'leadership', 'project management', 'team lead', 'technical lead'
        ];

        return keywords.filter(keyword => 
            jobCritical.some(critical => 
                keyword.toLowerCase().includes(critical) || 
                critical.includes(keyword.toLowerCase())
            )
        ).map(k => k.toLowerCase());
    }

    displayResults(analysis) {
        // Update match score
        const matchScore = document.getElementById('matchScore');
        const scoreCircle = document.querySelector('.score-circle');
        
        matchScore.textContent = `${analysis.matchScore}%`;
        
        // Update detailed scores
        if (analysis.cosineSimilarity !== undefined) {
            document.getElementById('semanticScore').textContent = `${analysis.cosineSimilarity}%`;
        }
        if (analysis.keywordMatchScore !== undefined) {
            document.getElementById('keywordScore').textContent = `${analysis.keywordMatchScore}%`;
        }
        
        // Animate score circle
        const angle = (analysis.matchScore / 100) * 360;
        scoreCircle.style.background = `conic-gradient(var(--primary-color) ${angle}deg, var(--border-color) ${angle}deg)`;

        // Update keyword stats
        document.getElementById('foundKeywords').textContent = analysis.foundKeywords.length;
        document.getElementById('missingKeywords').textContent = analysis.missingKeywords.length;

        // Display found keywords with categories
        const foundList = document.getElementById('foundKeywordsList');
        foundList.innerHTML = analysis.foundKeywords
            .map(keyword => {
                const category = this.categorizeKeyword(keyword);
                const priority = this.getKeywordPriority(keyword);
                
                return `
                    <div class="keyword-item found">
                        <span class="keyword-tag found ${priority}">${keyword}</span>
                        <div class="keyword-meta">
                            <span class="keyword-category">${category}</span>
                        </div>
                    </div>
                `;
            })
            .join('');

        // Display missing keywords with priority and section information
        const missingList = document.getElementById('missingKeywordsList');
        const missingKeywords = Array.isArray(analysis.missingKeywords) && 
                               analysis.missingKeywords.length > 0 && 
                               typeof analysis.missingKeywords[0] === 'object' ?
                               analysis.missingKeywords : 
                               analysis.missingKeywords.map(kw => ({ 
                                   keyword: kw, 
                                   priority: 'Medium', 
                                   section: 'other',
                                   weight: 1.0 
                               }));
                               
        missingList.innerHTML = missingKeywords
            .slice(0, 20) // Limit to 20 most important missing keywords
            .map(item => {
                const keyword = typeof item === 'string' ? item : item.keyword;
                const priority = typeof item === 'object' ? item.priority || 'Medium' : 'Medium';
                const section = typeof item === 'object' ? item.section || 'other' : 'other';
                const weight = typeof item === 'object' ? item.weight || 1.0 : 1.0;
                
                const category = this.categorizeKeyword(keyword);
                const keywordPriority = this.getKeywordPriority(keyword);
                const suggestions = this.getKeywordSuggestions(keyword);
                
                const sectionDisplay = section !== 'other' ? 
                    `<span class="keyword-section" title="Found in ${section} section">📍 ${section}</span>` : '';
                const priorityDisplay = priority !== 'Medium' ? 
                    `<span class="keyword-priority ${priority.toLowerCase()}" title="Priority: ${priority} (weight: ${weight.toFixed(1)})">⚡ ${priority}</span>` : '';
                
                return `
                    <div class="keyword-item missing">
                        <span class="keyword-tag missing ${keywordPriority}">${keyword}</span>
                        <div class="keyword-meta">
                            <span class="keyword-category">${category}</span>
                            ${sectionDisplay}
                            ${priorityDisplay}
                            ${suggestions.length > 0 ? `<span class="keyword-suggestions" title="Alternative terms: ${suggestions.join(', ')}">${suggestions.length} alternatives</span>` : ''}
                        </div>
                    </div>
                `;
            })
            .join('');

        // Show results section
        document.getElementById('resultsSection').style.display = 'block';

        // Generate enhanced recommendations
        this.generateEnhancedRecommendations(analysis);

        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }

    categorizeKeyword(keyword) {
        const categories = {
            'Programming Languages': [
                'java', 'javascript', 'js', 'python', 'typescript', 'ts', 'c++', 'c#', 'csharp', 
                'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'c', 'c language'
            ],
            'Frameworks & Libraries': [
                'spring', 'springboot', 'react', 'angular', 'vue', 'nodejs', 'express', 'django', 
                'flask', 'laravel', 'rails', 'jquery', 'bootstrap', 'tailwindcss', 'nextjs',
                'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'pandas', 'numpy', 
                'hugging face', 'huggingface', 'ray', 'sparkml', 'spark ml', 'mlflow'
            ],
            'Databases': [
                'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'sqlite', 
                'oracle', 'sql', 'nosql', 'dynamodb', 'cassandra'
            ],
            'Cloud Platforms': [
                'aws', 'amazon web services', 'azure', 'microsoft azure', 'google cloud', 
                'gcp', 'digitalocean', 'heroku', 'vercel'
            ],
            'DevOps & Tools': [
                'docker', 'kubernetes', 'k8s', 'jenkins', 'git', 'github', 'gitlab', 'ci/cd', 
                'terraform', 'ansible', 'maven', 'gradle', 'npm', 'webpack'
            ],
            'Development Practices': [
                'agile', 'scrum', 'kanban', 'devops', 'tdd', 'microservices', 'rest', 'api', 
                'restful', 'graphql'
            ],
            'Web Technologies': [
                'html', 'css', 'sass', 'json', 'xml', 'http', 'websocket', 'oauth', 'jwt'
            ],
            'Specialized Domains': [
                'machine learning', 'ml', 'ai', 'artificial intelligence', 'data science', 
                'deep learning', 'blockchain', 'cybersecurity', 'computer vision', 'nlp',
                'natural language processing', 'llms', 'large language models', 'agent systems',
                'context engineering', 'ml architecture', 'statistical modeling', 'data analytics',
                'information retrieval', 'neural networks', 'cnn', 'rnn', 'lstm', 'gan',
                'transformer', 'bert', 'gpt', 'computer graphics', '3d reconstruction',
                'object detection', 'image segmentation', 'speech recognition', 'robotics',
                'reinforcement learning', 'supervised learning', 'unsupervised learning',
                'semi-supervised learning', 'transfer learning', 'few-shot learning', 'zero-shot learning',
                'egocentric vision', 'vision language models', 'multimodal learning',
                'distributed systems', 'algorithm development'
            ],
            'Testing & QA': [
                'jest', 'mocha', 'cypress', 'selenium', 'junit', 'pytest', 'qa', 
                'unit testing', 'integration testing'
            ],
            'Education & Certifications': [
                'bachelor', 'master', 'phd', 'doctorate', 'computer science', 'cs', 
                'software engineering', 'information technology', 'IT', 'certification', 'certified'
            ],
            'Research & Academic': [
                'research', 'research scientist', 'software engineer', 'phd', 'doctorate', 'postdoc', 'publication', 'paper', 'conference',
                'cvpr', 'eccv', 'iccv', 'neurips', 'icml', 'iclr', 'acl', 'emnlp', 'siggraph',
                'patent', 'grant', 'fellowship', 'peer review', 'literature review',
                'experimental design', 'hypothesis testing', 'research methodology',
                'scientific computing', 'quantitative analysis'
            ],
            'Leadership & Management': [
                'leadership', 'project management', 'team lead', 'technical lead', 'architect', 'mentoring',
                'decision making', 'problem solving', 'communication'
            ],
            'Technical Skills': [
                'algorithms', 'algorithm design', 'optimization', 'performance optimization'
            ],
        };

        const keywordLower = keyword.toLowerCase();
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(k => keywordLower.includes(k) || k.includes(keywordLower))) {
                return category;
            }
        }
        return 'Technical Skills';
    }

    getKeywordPriority(keyword) {
        // High-priority: Core technical skills that are usually job requirements
        const highPriority = [
            // Programming languages that are commonly job requirements
            'java', 'javascript', 'js', 'python', 'typescript', 'c#', 'c++', 'c', 'c language',
            // Major frameworks that are often required
            'spring', 'springboot', 'react', 'angular', 'nodejs', 'django',
            // Essential cloud platforms
            'aws', 'azure', 'google cloud', 'gcp',
            // Critical development practices
            'agile', 'scrum', 'git', 'rest', 'api',
            // Database skills (usually required)
            'sql', 'mysql', 'postgresql', 'mongodb',
            // Key research/AI skills (for research positions)
            'machine learning', 'ml', 'artificial intelligence', 'ai', 'computer vision',
            'natural language processing', 'nlp', 'deep learning', 'software engineer', 
            'research scientist', 'algorithm design', 'algorithms'
        ];
        
        // Medium-priority: Important technical skills and tools
        const medPriority = [
            // Secondary frameworks and libraries
            'vue', 'express', 'flask', 'laravel', 'jquery',
            // ML frameworks and libraries
            'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'pandas', 'numpy',
            'hugging face', 'huggingface', 'ray', 'sparkml', 'spark ml', 'mlflow',
            'opencv', 'cuda', 'cudnn',
            // DevOps and build tools
            'docker', 'kubernetes', 'jenkins', 'maven', 'gradle', 'ci/cd',
            // Web technologies
            'html', 'css', 'json', 'graphql', 'websocket',
            // Testing frameworks
            'jest', 'junit', 'selenium', 'cypress',
            // Databases
            'redis', 'oracle', 'sqlite',
            // Research and advanced AI/ML concepts
            'neural networks', 'transformer', 'bert', 'gpt', '3d reconstruction',
            'computer graphics', 'robotics', 'reinforcement learning', 'data science',
            'statistical modeling', 'information retrieval', 'research', 'phd', 'publication'
        ];
        
        const keywordLower = keyword.toLowerCase();
        
        // Special case: 'IT' should be low priority, 'it' should be ignored
        if (keyword === 'IT') {
            return 'low-priority';
        }
        
        if (highPriority.some(k => keywordLower.includes(k) || k.includes(keywordLower))) {
            return 'high-priority';
        }
        if (medPriority.some(k => keywordLower.includes(k) || k.includes(keywordLower))) {
            return 'med-priority';
        }
        return 'low-priority';
    }

    getKeywordSuggestions(keyword) {
        const suggestions = {
            'java': ['Java SE', 'Core Java', 'Java 8+', 'Object-Oriented Programming'],
            'javascript': ['ES6+', 'DOM manipulation', 'Asynchronous programming'],
            'spring': ['Spring Boot', 'Spring Framework', 'Spring MVC', 'Dependency Injection'],
            'aws': ['Amazon Web Services', 'Cloud Computing', 'EC2', 'S3'],
            'azure': ['Microsoft Azure', 'Cloud Services', 'Azure DevOps'],
            'agile': ['Scrum', 'Sprint Planning', 'Iterative Development'],
            'git': ['Version Control', 'Source Control', 'GitHub', 'GitLab'],
            'maven': ['Build Tools', 'Project Management', 'Dependency Management'],
            'tomcat': ['Application Server', 'Web Server', 'Servlet Container'],
            'eclipse': ['IDE', 'Integrated Development Environment', 'Java IDE']
        };

        const keywordLower = keyword.toLowerCase();
        for (const [key, values] of Object.entries(suggestions)) {
            if (keywordLower.includes(key) || key.includes(keywordLower)) {
                return values;
            }
        }
        return [];
    }

    generateEnhancedRecommendations(analysis) {
        const recommendations = [];

        // Specific recommendations based on missing high-priority keywords
        const missingHighPriority = analysis.missingKeywords.filter(k => 
            this.getKeywordPriority(k) === 'high-priority'
        );

        if (missingHighPriority.length > 0) {
            recommendations.push({
                title: '🔥 Critical Missing Keywords',
                description: `You're missing these high-priority keywords: <strong>${missingHighPriority.slice(0, 5).join(', ')}</strong>. These are likely essential for this role and should be prioritized in your resume updates.`
            });
        }

        // Category-based recommendations
        const missingByCategory = {};
        analysis.missingKeywords.forEach(keyword => {
            const category = this.categorizeKeyword(keyword);
            if (!missingByCategory[category]) missingByCategory[category] = [];
            missingByCategory[category].push(keyword);
        });

        Object.entries(missingByCategory).forEach(([category, keywords]) => {
            if (keywords.length >= 3) {
                recommendations.push({
                    title: `📚 ${category} Skills Gap`,
                    description: `Consider strengthening your ${category.toLowerCase()} skills. Missing: ${keywords.slice(0, 4).join(', ')}${keywords.length > 4 ? ` and ${keywords.length - 4} more` : ''}.`
                });
            }
        });

        // Match score recommendations
        if (analysis.matchScore >= 70) {
            recommendations.push({
                title: '✅ Strong Match!',
                description: `Great job! Your ${analysis.matchScore}% match indicates strong alignment. Focus on the few remaining missing keywords to perfect your application.`
            });
        } else if (analysis.matchScore >= 50) {
            recommendations.push({
                title: '⚠️ Moderate Match',
                description: `Your ${analysis.matchScore}% match is decent but has room for improvement. Focus on adding the high-priority missing keywords to boost your score.`
            });
        } else {
            recommendations.push({
                title: '🚨 Low Match Score',
                description: `Your ${analysis.matchScore}% match suggests significant gaps. This resume may not be well-tailored for this specific role. Consider substantial revisions.`
            });
        }

        // Practical action items
        recommendations.push({
            title: '💡 Action Steps',
            description: `
                1. Add ${Math.min(5, analysis.missingKeywords.length)} missing keywords to your resume
                2. Use exact terminology from the job description
                3. Provide context/examples for each skill you add
                4. Re-run this analysis after updates
            `
        });

        const recommendationsContainer = document.getElementById('recommendations');
        recommendationsContainer.innerHTML = recommendations
            .map(rec => `
                <div class="recommendation-item">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                </div>
            `).join('');
    }

    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.matchScore < 70) {
            recommendations.push({
                title: 'Improve Keyword Match',
                description: `Your match score is ${analysis.matchScore}%. Consider adding more relevant keywords from the missing list to your resume.`
            });
        }

        if (analysis.missingKeywords.length > 15) {
            recommendations.push({
                title: 'Technical Skills Gap',
                description: 'You have several missing technical keywords. Focus on highlighting your most relevant skills and consider learning high-priority missing skills.'
            });
        }

        if (analysis.foundKeywords.length < 10) {
            recommendations.push({
                title: 'Optimize Resume Content',
                description: 'Your resume might be too generic. Tailor it more specifically to this job description by using industry-specific terminology.'
            });
        }

        recommendations.push({
            title: 'Cover Letter Strategy',
            description: 'Use the generated cover letter to address missing keywords and explain how your experience relates to the specific requirements.'
        });

        const recommendationsContainer = document.getElementById('recommendations');
        recommendationsContainer.innerHTML = recommendations
            .map(rec => `
                <div class="recommendation-item">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                </div>
            `).join('');
    }

    async generateCoverLetter() {
        console.log('generateCoverLetter called');
        console.log('Resume text available:', !!this.resumeText);
        console.log('Job description available:', !!this.jobDescription);
        console.log('Resume length:', this.resumeText?.length || 0);
        console.log('Job description length:', this.jobDescription?.length || 0);
        
        if (!this.resumeText || !this.jobDescription) {
            this.showNotification('Please upload your resume and enter the job description first', 'error');
            return;
        }

        const isAIMode = document.getElementById('aiModeToggle').checked;
        console.log('AI Mode:', isAIMode);
        
        if (isAIMode) {
            await this.generateGrammarlyCoverLetter();
        } else {
            await this.generateLocalCoverLetter();
        }
    }

    async generateGrammarlyCoverLetter() {
        // Step 1: Collect structured data (Grammarly's approach)
        const apiKey = localStorage.getItem('llm_api_key');
        if (!apiKey) {
            this.showNotification('Please save your API key first', 'error');
            document.getElementById('apiKeyInput').focus();
            return;
        }

        const structuredData = this.collectStructuredData();
        
        const loadingDiv = document.getElementById('coverLetterLoading');
        const contentDiv = document.getElementById('coverLetterContent');
        const generateBtn = document.getElementById('generateCoverLetterBtn');
        const spinner = generateBtn.querySelector('.loading-spinner');
        const btnText = generateBtn.querySelector('.btn-text');
        const loadingText = document.getElementById('loadingText');

        // Show loading state
        loadingDiv.style.display = 'block';
        contentDiv.style.display = 'none';
        generateBtn.disabled = true;
        spinner.style.display = 'block';
        btnText.textContent = 'AI Generating...';
        loadingText.textContent = 'Grammarly-style AI is crafting your professional cover letter...';

        try {
            // Step 2: Generate draft using Grammarly's exact prompt structure
            const coverLetter = await this.callLLMWithGrammarlyPrompt(structuredData, apiKey);
            
            // Step 3: Post-process and format (Grammarly's refinement)
            const formattedLetter = this.formatGrammarlyLetter(coverLetter, structuredData);
            
            // Display the result
            document.getElementById('coverLetterText').value = formattedLetter;
            
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            
            this.updateLetterStats();
            this.showNotification('AI cover letter generated successfully! 🤖✨', 'success');
            
        } catch (error) {
            console.error('AI Cover letter generation error:', error);
            
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            
            // Fallback to local generation
            const fallbackLetter = await this.generateLocalCoverLetterContent();
            document.getElementById('coverLetterText').value = fallbackLetter;
            this.showNotification('AI generation failed. Generated local version instead.', 'warning');
            
        } finally {
            generateBtn.disabled = false;
            spinner.style.display = 'none';
            btnText.textContent = 'Generate Cover Letter';
            loadingText.textContent = 'Crafting your personalized cover letter...';
        }
    }

    async generateLocalCoverLetter() {
        const loadingDiv = document.getElementById('coverLetterLoading');
        const contentDiv = document.getElementById('coverLetterContent');
        const generateBtn = document.getElementById('generateCoverLetterBtn');
        const spinner = generateBtn.querySelector('.loading-spinner');
        const btnText = generateBtn.querySelector('.btn-text');

        // Show loading state
        loadingDiv.style.display = 'block';
        contentDiv.style.display = 'none';
        generateBtn.disabled = true;
        spinner.style.display = 'block';
        btnText.textContent = 'Generating...';

        try {
            // Simulate processing time for better UX
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const coverLetter = await this.generateLocalCoverLetterContent();
            
            // Display the result
            document.getElementById('coverLetterText').value = coverLetter;
            
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            
            this.updateLetterStats();
            this.showNotification('Free cover letter generated successfully! 🎆', 'success');
            
        } catch (error) {
            console.error('Cover letter generation error:', error);
            
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            
            // Show fallback message
            document.getElementById('coverLetterText').value = this.getFallbackCoverLetter();
            this.showNotification('Generated basic cover letter template.', 'info');
            
        } finally {
            generateBtn.disabled = false;
            spinner.style.display = 'none';
            btnText.textContent = 'Generate Cover Letter';
        }
    }

    collectStructuredData() {
        // Step 1: Resume Parsing (Extract key facts for any user)
        const resumeData = this.parseResumeData();
        
        // Step 2: JD Analysis (Extract targets)
        const jdData = this.parseJobDescription();
        
        // Step 3: Smart Keyword Match (weighted)
        const matchedSkills = this.getWeightedSkillMatch(resumeData.skills, jdData.requirements);
        
        return {
            // Parsed resume data
            name: resumeData.name,
            email: resumeData.email,
            phone: resumeData.phone,
            experiences: resumeData.experiences,
            skills: resumeData.skills,
            education: resumeData.education,
            
            // Parsed JD data
            jobTitle: jdData.position,
            company: jdData.company,
            requirements: jdData.requirements,
            niceToHaves: jdData.niceToHaves,
            
            // Matched data
            matchedSkills: matchedSkills,
            
            // User inputs
            whyInterested: document.getElementById('whyInterestedInput')?.value || 'I am excited about this opportunity to contribute to your team',
            tone: document.getElementById('toneSelector').value
        };
    }

    // Enhanced project detection for ongoing work
    detectOngoingProjects(resumeText) {
        const projects = [];
        const lines = resumeText.split('\n');
        let currentProject = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detect project headers with ongoing indicators
            if (this.projectPatterns.ongoing.test(line)) {
                const projectMatch = line.match(/([A-Za-z][A-Za-z0-9\s\-]+)\s*[-–—]\s*([^\n]+)/)
                if (projectMatch) {
                    currentProject = {
                        name: projectMatch[1].trim(),
                        description: projectMatch[2].trim(),
                        details: [],
                        isOngoing: true,
                        metrics: []
                    };
                }
            }
            
            // Collect project details with metrics
            if (currentProject && (line.startsWith('•') || line.startsWith('-') || /^[A-Z]/.test(line))) {
                if (this.projectPatterns.metrics.test(line)) {
                    // Extract specific metrics
                    const metrics = line.match(/\d+\+?%|\d+\+?\s+(?:users?|records?)|<\d+s|\d+\+\s+[\w\s]+/g);
                    if (metrics) currentProject.metrics.push(...metrics);
                }
                currentProject.details.push(line);
            }
            
            // Save project when we hit next section
            if (currentProject && (line === '' || /^[A-Z\s]{3,}$/.test(line))) {
                projects.push(currentProject);
                currentProject = null;
            }
        }
        
        if (currentProject) projects.push(currentProject);
        return projects;
    }

    // Step 1: Advanced Resume Parsing
    parseResumeData() {
        if (!this.resumeText || this.resumeText.length < 50) {
            return {
                name: '[Your Name]',
                email: 'your.email@example.com',
                phone: '[Your Phone]',
                experiences: [],
                skills: ['relevant technical skills'],
                education: 'Relevant educational background',
                yearsOfExperience: '2+',
                primarySkills: 'technical expertise'
            };
        }

        // Extract name (look for capitalized names at the beginning)
        let name = '[Your Name]';
        const namePatterns = [
            /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/m,
            /([A-Z]{2,}\s+[A-Z]{2,})/,
            /Name:\s*([A-Za-z\s]+)/i
        ];
        
        for (const pattern of namePatterns) {
            const match = this.resumeText.match(pattern);
            if (match && match[1].trim().length > 3 && match[1].trim().length < 50) {
                name = match[1].trim();
                break;
            }
        }

        // Extract contact information
        const emailMatch = this.resumeText.match(/[\w.-]+@[\w.-]+\.\w+/);
        const phoneMatch = this.resumeText.match(/\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}/);
        
        // Extract years of experience
        const expMatch = this.resumeText.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
        const yearsOfExperience = expMatch ? `${expMatch[1]}+` : '2+';
        
        // Extract experiences with metrics (prioritize quantifiable achievements)
        const experiencePatterns = [
            // Look for bullet points with numbers/percentages
            /[•\-*]\s*([^\n]*(?:\d+%|\d+x|\d+\+|\d+K|\d+M|\d+ users|\d+ projects|\d+ systems|\d+ applications|increased|decreased|improved|reduced|optimized|built|developed|implemented|designed|managed)[^\n]*)/gi,
            // Look for sentences with achievements
            /([^.\n]*(?:achieved|accomplished|delivered|created|led|spearheaded|initiated)[^.\n]*(?:\d+%|\d+x|\d+\+|\d+K|\d+M)[^.\n]*)/gi,
        ];
        
        const experiences = [];
        experiencePatterns.forEach(pattern => {
            const matches = this.resumeText.match(pattern) || [];
            matches.forEach(match => {
                const clean = match.replace(/^[•\-*\s]+/, '').trim();
                if (clean.length > 20 && clean.length < 200) {
                    experiences.push(clean);
                }
            });
        });
        
        // Remove duplicates and get top 3
        const uniqueExperiences = [...new Set(experiences)].slice(0, 3);

        // Extract skills using enhanced patterns
        const skills = this.extractTechnicalSkills();
        
        // Extract education
        const educationPatterns = [
            /(Bachelor.*?(?:Computer Science|Engineering|Science|Technology|Mathematics))/gi,
            /(Master.*?(?:Computer Science|Engineering|Science|Technology|Mathematics))/gi,
            /(PhD.*?(?:Computer Science|Engineering|Science|Technology|Mathematics))/gi,
            /(B\.S\.|M\.S\.|Ph\.D\.).*?(?:Computer Science|Engineering|Science|Technology|Mathematics)/gi
        ];
        
        let education = 'Relevant educational background';
        for (const pattern of educationPatterns) {
            const match = this.resumeText.match(pattern);
            if (match) {
                education = match[0].trim();
                break;
            }
        }

        // Get primary skills for summary
        const topSkills = skills.slice(0, 3);
        const primarySkills = topSkills.length > 0 ? topSkills.join(', ') : 'technical expertise';

        return {
            name,
            email: emailMatch ? emailMatch[0] : 'your.email@example.com',
            phone: phoneMatch ? phoneMatch[0] : '[Your Phone]',
            experiences: uniqueExperiences,
            skills: skills.slice(0, 12), // Top 12 relevant skills
            education,
            yearsOfExperience,
            primarySkills
        };
    }

    // Step 2: Enhanced JD Analysis
    parseJobDescription() {
        if (!this.jobDescription || this.jobDescription.length < 50) {
            return {
                position: 'the position',
                company: 'the company',
                requirements: '',
                niceToHaves: ''
            };
        }

        // Extract position with better patterns
        let position = 'the position';
        const positionPatterns = [
            /(?:Position|Role|Title):\s*([^\n]+)/i,
            /^([A-Z][A-Za-z\s-]+(?:Engineer|Developer|Manager|Analyst|Scientist|Specialist|Lead|Director|Intern))\s*$/m,
            /We are (?:looking for|hiring|seeking)\s*(?:a|an)?\s*([A-Z][A-Za-z\s-]+(?:Engineer|Developer|Manager|Analyst|Scientist))/i,
            /Join (?:our team|us) as (?:a|an)?\s*([A-Z][A-Za-z\s-]+(?:Engineer|Developer|Manager|Analyst|Scientist))/i
        ];
        
        for (const pattern of positionPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1] && match[1].trim().length < 100) {
                position = match[1].trim();
                break;
            }
        }

        // Extract company with better patterns
        let company = 'the company';
        const companyPatterns = [
            /at ([A-Z][A-Za-z\s&.,]+?)(?:\s*,|\s*\.|\s*-|\s*\n|$)/,
            /([A-Z][A-Za-z\s&.,]+?) is (?:seeking|looking|hiring|a)/,
            /Join ([A-Z][A-Za-z\s&.,]+?)(?:'s|\s|$)/,
            /Company:\s*([A-Z][A-Za-z\s&.,]+)/i
        ];
        
        for (const pattern of companyPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1] && match[1].trim().length > 2 && match[1].trim().length < 80) {
                // Filter out common false positives
                const candidate = match[1].trim();
                if (!candidate.match(/^(We|Our|The|This|You|Your|Position|Role|Team)$/i)) {
                    company = candidate;
                    break;
                }
            }
        }

        // Extract requirements and qualifications
        const requirementsMatch = this.jobDescription.match(/(?:Requirements|Qualifications|Must Have|Essential)[\s\S]*?(?=(?:Nice|Preferred|Bonus|Benefits|Company|About|$))/i);
        const requirements = requirementsMatch ? requirementsMatch[0] : '';
        
        const niceToHavesMatch = this.jobDescription.match(/(?:Nice to Have|Preferred|Bonus|Plus)[\s\S]*?(?=(?:Company|About|Benefits|$))/i);
        const niceToHaves = niceToHavesMatch ? niceToHavesMatch[0] : '';

        return {
            position,
            company,
            requirements,
            niceToHaves
        };
    }

    // Step 3: Smart Keyword Match (weighted by metrics)
    getWeightedSkillMatch(resumeSkills, jdRequirements) {
        const jdSkills = this.extractKeywords(jdRequirements);
        const matchedSkills = [];
        
        resumeSkills.forEach(skill => {
            jdSkills.forEach(jdSkill => {
                const similarity = this.calculateStringSimilarity(
                    skill.toLowerCase(), 
                    jdSkill.toLowerCase()
                );
                
                if (similarity > 0.8 || 
                    skill.toLowerCase().includes(jdSkill.toLowerCase()) ||
                    jdSkill.toLowerCase().includes(skill.toLowerCase())) {
                    if (!matchedSkills.includes(skill)) {
                        matchedSkills.push(skill);
                    }
                }
            });
        });
        
        return matchedSkills.slice(0, 8); // Top 8 matched skills
    }

    extractTechnicalSkills() {
        const skillPatterns = {
            // Programming languages
            languages: /\b(JavaScript|Python|Java|C\+\+|C#|TypeScript|Go|Rust|Swift|Kotlin|Scala|R|MATLAB|PHP|Ruby|Perl|C\b(?!ompany))\b/gi,
            
            // Frameworks and libraries
            frameworks: /\b(React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Rails|jQuery|Bootstrap|TensorFlow|PyTorch|scikit-learn|Keras|Pandas|NumPy|OpenCV|CUDA|Docker|Kubernetes)\b/gi,
            
            // Databases and tools
            tools: /\b(MySQL|PostgreSQL|MongoDB|Redis|Git|AWS|Azure|GCP|Linux|SQL|NoSQL|Hadoop|Spark|Tableau|PowerBI|Figma|Photoshop)\b/gi,
            
            // Domain expertise
            domains: /\b(Machine Learning|Deep Learning|AI|Data Science|Computer Vision|NLP|Blockchain|DevOps|Agile|Scrum|UI\/UX|Frontend|Backend|Full[\s-]?Stack)\b/gi
        };
        
        const skills = new Set();
        
        Object.values(skillPatterns).forEach(pattern => {
            const matches = this.resumeText.match(pattern) || [];
            matches.forEach(skill => {
                skills.add(skill.trim());
            });
        });
        
        return Array.from(skills);
    }

    async callLLMWithGrammarlyPrompt(data, apiKey) {
        // Step 4: Grammarly-Style Prompt (structured, role-specific)
        const experiencesText = data.experiences.length > 0 ? 
            data.experiences.join('\n• ') : 
            'Relevant experience in software development and technology';
            
        const matchedSkillsText = data.matchedSkills.length > 0 ? 
            data.matchedSkills.join(', ') : 
            data.skills.slice(0, 6).join(', ');

        const prompt = `Write a professional cover letter for ${data.jobTitle} at ${data.company}.

APPLICANT DETAILS:
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone}
Education: ${data.education || 'Relevant educational background'}

TOP RESUME EXPERIENCES (use these EXACT facts):
• ${experiencesText}

MATCHED SKILLS: ${matchedSkillsText}

JOB REQUIREMENTS: ${data.requirements.substring(0, 800)}

WHY INTERESTED: ${data.whyInterested}

STRUCTURE REQUIREMENTS:
**PARA 1 (Intro)**: Express interest in "${data.jobTitle}" at ${data.company}. Mention relevant background + key skills.

**PARA 2 (Experience)**: Highlight 2-3 specific achievements from resume experiences above. Use EXACT metrics/numbers. Match to job requirements.

**PARA 3 (Why Company + Close)**: Show enthusiasm for company/role. Call to action for interview.

GUIDELINES:
- Use the applicant's REAL name: ${data.name}
- Reference ACTUAL experience bullets with specific metrics
- Match JD keywords: ${data.matchedSkills.slice(0, 5).join(', ')}
- 280-320 words total
- Professional ${data.tone} tone
- Active voice, confident but not boastful

Do NOT make up fake experiences - only use the provided resume facts.`;

        const provider = document.getElementById('llmProvider').value;
        
        if (provider === 'openai') {
            return await this.callOpenAI(prompt, apiKey);
        } else if (provider === 'gemini') {
            return await this.callGemini(prompt, apiKey);
        } else {
            throw new Error('Unsupported LLM provider');
        }
    }

    async callOpenAI(prompt, apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a professional cover letter writer who creates personalized, ATS-friendly letters. Use ONLY the provided resume facts - never invent experiences or skills. Write in a confident, professional tone with specific metrics and achievements. Structure: compelling intro, 2 experience paragraphs with examples, enthusiastic close.' 
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 600,
                temperature: 0.3  // Lower temperature for more consistent, factual output
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`OpenAI API error: ${error.error?.message || 'Failed to generate cover letter'}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    async callGemini(prompt, apiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 600,
                    temperature: 0.6
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`Gemini API error: ${error.error?.message || 'Failed to generate cover letter'}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    }

    formatGrammarlyLetter(body, data) {
        // Step 5: Post-Format (professional template)
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Clean the AI-generated body
        const cleanBody = body
            .replace(/^.*?Dear.*?$/m, '') // Remove AI-generated header if present
            .replace(/Best regards,.*$/s, '') // Remove AI-generated signature if present
            .replace(/Sincerely,.*$/s, '') // Remove AI-generated signature if present
            .trim();

        return `${data.name}
${data.phone} | ${data.email} | LinkedIn | Portfolio

${today}

Hiring Manager
${data.company}
[Company Address if known]

Dear Hiring Manager,

${cleanBody}

Best regards,

${data.name}
LinkedIn | Portfolio`;
    }

    async generateLocalCoverLetterContent() {
        try {
            // Enhanced debugging
            console.log('=== COVER LETTER GENERATION DEBUG ===');
            console.log('Resume text length:', this.resumeText?.length || 0);
            console.log('Job description length:', this.jobDescription?.length || 0);
            console.log('Resume preview:', this.resumeText?.substring(0, 300) + '...');
            console.log('Job preview:', this.jobDescription?.substring(0, 300) + '...');
            
            // Ensure we have data
            if (!this.resumeText || this.resumeText.length < 20 || !this.jobDescription || this.jobDescription.length < 20) {
                console.log('Insufficient data - using fallback');
                return this.buildFallbackCoverLetter();
            }

            // Step 1: Extract REAL data from user's resume and job description
            console.log('=== PARSING REAL USER DATA ===');
            const resumeData = this.parseUserResume();
            const jobData = this.parseUserJobDescription();
            const analysis = this.performAdvancedMatching();
            
            console.log('Parsed user resume data:', resumeData);
            console.log('Parsed user job data:', jobData);
            console.log('Analysis results:', analysis);
            
            // Step 2: Generate cover letter using actual parsed data
            return this.buildRealCoverLetter(resumeData, jobData, analysis);
            
        } catch (error) {
            console.error('Error generating cover letter:', error);
            return this.buildFallbackCoverLetter();
        }
    }

    // Parse user's actual resume content
    parseUserResume() {
        console.log('Parsing actual resume content...');
        
        // Extract name from first few lines or filename
        const lines = this.resumeText.split('\n').filter(line => line.trim().length > 0);
        let name = 'Your Name';
        
        // Try to extract from filename first
        const uploadedFileName = document.querySelector('.file-info')?.textContent || '';
        const fileNameMatch = uploadedFileName.match(/([A-Z][a-z]+[_\s]+[A-Z][a-z]+)/);
        if (fileNameMatch) {
            name = fileNameMatch[1].replace(/_/g, ' ');
        } else {
            // Look in resume content
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i].trim();
                // Look for name-like patterns
                if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(line) && 
                    line.length < 50 && !line.toLowerCase().includes('resume') &&
                    !line.toLowerCase().includes('skills') && !line.toLowerCase().includes('experience')) {
                    name = line;
                    break;
                }
            }
        }
        
        // Extract email
        const emailMatch = this.resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const email = emailMatch ? emailMatch[0] : 'your.email@example.com';
        
        // Extract phone
        const phoneMatch = this.resumeText.match(/[\(\d\s\-\)\.]{10,15}/);
        const phone = phoneMatch ? phoneMatch[0].trim() : 'Your Phone';
        
        // Extract technical skills by looking for common tech terms
        const techTerms = ['Python', 'JavaScript', 'SQL', 'React', 'Java', 'AWS', 'Docker', 'API', 'Machine Learning', 'Data Science'];
        const foundSkills = techTerms.filter(skill => 
            this.resumeText.toLowerCase().includes(skill.toLowerCase())
        );
        
        // Extract work experiences and achievements
        const achievements = this.extractAchievements();
        
        console.log('Extracted from resume:', { name, email, phone, foundSkills, achievements });
        
        return {
            name,
            email,
            phone,
            skills: foundSkills,
            achievements,
            hasRealData: name !== 'Your Name' || email !== 'your.email@example.com' || foundSkills.length > 0
        };
    }

    // Parse user's actual job description
    parseUserJobDescription() {
        console.log('Parsing actual job description...');
        
        // Extract job title - look at the beginning
        const firstLines = this.jobDescription.split('\n').slice(0, 5);
        let jobTitle = 'the position';
        
        for (const line of firstLines) {
            const cleanLine = line.trim();
            // Look for job titles (contains common job keywords)
            if (/(engineer|developer|analyst|manager|specialist|coordinator|intern|scientist)/i.test(cleanLine) &&
                cleanLine.length < 100 && cleanLine.length > 5) {
                jobTitle = cleanLine;
                break;
            }
        }
        
        // Extract company name
        let company = 'the company';
        const companyMatches = [
            this.jobDescription.match(/at\s+(Meta|Google|Apple|Microsoft|Amazon|Facebook|Netflix|Tesla|Uber|Airbnb|[A-Z][a-z]{3,15})(?![\w\s]*(?:Engineer|Developer|Analyst|Manager))/),
            this.jobDescription.match(/([A-Z][a-z]{3,20})\s*·\s*[A-Z][a-z]+,\s*[A-Z]{2}/),
            this.jobDescription.match(/^([A-Z][a-z]{3,20})(?:\s+Inc|\s+Corp|\s+LLC)?$/m)
        ];
        
        for (const match of companyMatches) {
            if (match && match[1]) {
                const candidate = match[1].trim();
                if (!/^(we|our|the|this|you|your|data|engineer|analyst)$/i.test(candidate)) {
                    company = candidate;
                    break;
                }
            }
        }
        
        // Extract key requirements and skills mentioned
        const jobSkills = ['Python', 'JavaScript', 'SQL', 'React', 'Java', 'AWS', 'Docker', 'API', 'Machine Learning'].filter(skill =>
            this.jobDescription.toLowerCase().includes(skill.toLowerCase())
        );
        
        console.log('Extracted from job description:', { jobTitle, company, jobSkills });
        
        return {
            title: jobTitle,
            company,
            requiredSkills: jobSkills,
            hasRealData: jobTitle !== 'the position' || company !== 'the company' || jobSkills.length > 0
        };
    }

    // Extract and rewrite achievements from resume text
    extractAchievements() {
        // Find quantified accomplishments
        const patterns = [
            /●\s*([^●\n]{20,200}(?:\d+%|\d+\+|\d+ [a-z]+)[^●\n]{0,100})/gi,
            /•\s*([^•\n]{20,200}(?:improved|increased|reduced|built|developed|generated|achieved)[^•\n]{0,100})/gi
        ];
        
        const rawAchievements = [];
        patterns.forEach(pattern => {
            const matches = this.resumeText.match(pattern) || [];
            matches.forEach(match => {
                const clean = match.replace(/^[●•\-*\s]+/, '').trim();
                if (clean.length > 20 && rawAchievements.length < 3) {
                    rawAchievements.push(clean);
                }
            });
        });
        
        // Convert raw achievements into proper sentences
        return rawAchievements.map(raw => this.convertToProperSentence(raw)).filter(Boolean);
    }
    
    // Convert raw resume bullet points into proper sentences
    convertToProperSentence(rawText) {
        try {
            // Clean up formatting
            let clean = rawText
                .replace(/[●•\-*]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .trim();
            
            // Extract key metrics and actions
            const metrics = clean.match(/\d+[%\+]?(?:\s*[a-z]+)?/gi) || [];
            const actions = clean.match(/\b(generated|built|developed|improved|increased|reduced|created|implemented|achieved|led|managed|architected|engineered)\b/gi) || [];
            
            if (actions.length === 0 && metrics.length === 0) return null;
            
            // Create a proper sentence
            let sentence = '';
            if (actions.length > 0) {
                const mainAction = actions[0].toLowerCase();
                sentence = `${mainAction.charAt(0).toUpperCase() + mainAction.slice(1)} `;
                
                // Add context
                if (clean.includes('model') || clean.includes('algorithm')) {
                    sentence += 'machine learning models and algorithms';
                } else if (clean.includes('data') || clean.includes('pipeline')) {
                    sentence += 'data processing systems and pipelines';
                } else if (clean.includes('web') || clean.includes('portal')) {
                    sentence += 'web applications and user interfaces';
                } else {
                    sentence += 'technical solutions and systems';
                }
                
                // Add metrics if available
                if (metrics.length > 0) {
                    const topMetric = metrics[0];
                    if (mainAction === 'improved' || mainAction === 'increased') {
                        sentence += `, achieving ${topMetric} improvement`;
                    } else if (mainAction === 'reduced') {
                        sentence += `, reducing processing time by ${topMetric}`;
                    } else {
                        sentence += `, impacting ${topMetric} of operations`;
                    }
                }
            }
            
            return sentence.length > 20 ? sentence : null;
        } catch (error) {
            console.log('Error converting sentence:', error);
            return null;
        }
    }

    // Build cover letter using REAL user data
    buildRealCoverLetter(resumeData, jobData, analysis) {
        console.log('Building cover letter with real data...');
        
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Use real data when available, fallbacks when not
        const name = resumeData.name !== 'Your Name' ? resumeData.name : 'Your Name';
        const email = resumeData.email !== 'your.email@example.com' ? resumeData.email : 'your.email@example.com';  
        const phone = resumeData.phone !== 'Your Phone' ? resumeData.phone : 'Your Phone';
        const jobTitle = jobData.title !== 'the position' ? jobData.title : 'this position';
        const company = jobData.company !== 'the company' ? jobData.company : 'your organization';
        
        // Match skills between resume and job
        const matchedSkills = resumeData.skills.filter(skill => 
            jobData.requiredSkills.includes(skill)
        );
        const allRelevantSkills = [...new Set([...matchedSkills, ...resumeData.skills, ...jobData.requiredSkills])].slice(0, 6);
        
        const header = `${name}
${email} | LinkedIn | Portfolio
${today}

Hiring Manager
${company}

Dear Hiring Manager,`;

        // Opening paragraph - connect experience to role
        const topSkills = allRelevantSkills.slice(0, 3).join(', ') || 'technical skills';
        const opening = `I am excited to apply for the ${jobTitle} position at ${company}. With hands-on experience in ${topSkills} and a proven track record of delivering scalable solutions, I am confident I can contribute significantly to your team's success.`;

        // Experience paragraph - use actual achievements
        let experience = '';
        if (resumeData.achievements.length > 0) {
            const primaryAchievement = resumeData.achievements[0];
            const secondaryAchievement = resumeData.achievements.length > 1 ? resumeData.achievements[1] : null;
            
            experience = `In my recent work, I have ${primaryAchievement}.`;
            if (secondaryAchievement) {
                experience += ` Additionally, I ${secondaryAchievement}.`;
            }
            experience += ` This hands-on experience with ${allRelevantSkills.slice(0, 4).join(', ')} directly aligns with the technical requirements for this role.`;
        } else {
            experience = `My professional experience includes developing applications and systems using ${topSkills}. I have demonstrated expertise in problem-solving, technical implementation, and delivering high-quality results that align with your requirements.`;
        }

        // Value proposition - natural conclusion without match percentages
        let value = '';
        if (matchedSkills.length > 0) {
            value = `I am particularly excited about this opportunity because my expertise in ${matchedSkills.join(', ')} aligns well with your technical requirements. I am drawn to ${company}'s innovative approach and would welcome the chance to contribute to your team's continued success.`;
        } else {
            value = `I am particularly excited about this opportunity to work with ${company}. My technical background and passion for solving complex problems would enable me to make meaningful contributions to your team's innovative projects.`;
        }

        const closing = `Thank you for considering my application. I look forward to discussing how my experience and passion for technology can benefit ${company}.

Best regards,
${name}`;

        const result = `${header}

${opening}

${experience}

${value}

${closing}`;
        
        console.log('Generated cover letter:', result);
        return result;
    }

    // Enhanced Resume Data Extraction (Perplexity-style)
    enhancedParseResumeData() {
        console.log('Enhanced resume parsing...');
        
        // Extract name - improved patterns
        let name = '[Your Name]';
        const namePatterns = [
            // First line name pattern
            /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*$/m,
            // Name with title
            /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)(?:\s*-|\s*,|\s*\|)/m,
            // Name: format
            /(?:Name|Full Name):\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/i,
        ];
        
        for (const pattern of namePatterns) {
            const match = this.resumeText.match(pattern);
            if (match && match[1].trim().length > 3 && match[1].trim().length < 50) {
                name = match[1].trim();
                console.log('Found name:', name);
                break;
            }
        }
        
        // Extract contact info with better patterns
        const emailMatch = this.resumeText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const email = emailMatch ? emailMatch[1] : 'your.email@example.com';
        
        const phoneMatch = this.resumeText.match(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
        const phone = phoneMatch ? phoneMatch[0] : '[Your Phone]';
        
        // Extract skills - comprehensive technical skills
        const allSkills = this.extractAllTechnicalSkills();
        
        // Extract quantified experiences
        const experiences = this.extractQuantifiedExperiences();
        
        // Extract education with better matching
        let education = 'Relevant educational background';
        const educationMatch = this.resumeText.match(/((?:Bachelor|Master|PhD|B\.S\.|M\.S\.|Ph\.D\.).*?(?:Computer Science|Engineering|Data Science|Mathematics|Technology)[^\\n]*)/i);
        if (educationMatch) {
            education = educationMatch[1].trim();
        }
        
        return {
            name,
            email,
            phone,
            skills: allSkills,
            experiences,
            education,
            primarySkills: allSkills.slice(0, 4).join(', ')
        };
    }

    // Enhanced Job Description Parsing (Perplexity-style)
    enhancedParseJobDescription() {
        console.log('Enhanced job description parsing...');
        
        // Extract position with better accuracy
        let position = 'the advertised position';
        const positionPatterns = [
            // Job title at start
            /^([A-Z][A-Za-z\s\-,]+(?:Engineer|Developer|Analyst|Manager|Scientist|Specialist|Lead|Director|Coordinator|Intern))/m,
            // Position: format
            /(?:Position|Job Title|Role):\s*([A-Z][A-Za-z\s\-,]+)/i,
            // We are looking for format
            /We are (?:looking for|seeking|hiring)(?:\s+an?\s+)?([A-Z][A-Za-z\s\-,]+)/i,
            // Join us as format
            /Join us as(?:\s+an?\s+)?([A-Z][A-Za-z\s\-,]+)/i
        ];
        
        for (const pattern of positionPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1] && match[1].trim().length < 80) {
                position = match[1].trim().replace(/[.,:;]$/, '');
                console.log('Found position:', position);
                break;
            }
        }
        
        // Extract company with better patterns
        let company = 'the company';
        const companyPatterns = [
            // Company: format
            /(?:Company|Organization):\s*([A-Z][A-Za-z\s&.,0-9]+)/i,
            // At Company format
            /(?:at|with|join)\s+([A-Z][A-Za-z&.,0-9]{2,30})(?:\s+(?:Inc|LLC|Corp|Ltd|Co)\.?)?/i,
            // Company is looking format
            /([A-Z][A-Za-z&.,0-9]{2,30})\s+is\s+(?:looking|seeking|hiring)/i
        ];
        
        for (const pattern of companyPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1] && match[1].trim().length > 1 && match[1].trim().length < 50) {
                const candidate = match[1].trim();
                // Filter out common false positives
                if (!/^(we|our|the|this|you|your|position|role|team|company|candidates?)$/i.test(candidate)) {
                    company = candidate;
                    console.log('Found company:', company);
                    break;
                }
            }
        }
        
        // Extract key requirements
        const requirements = this.extractJobRequirements();
        
        return {
            position,
            company,
            requirements
        };
    }

    // Extract all technical skills comprehensively
    extractAllTechnicalSkills() {
        const technicalTerms = [
            // Programming Languages
            'Python', 'JavaScript', 'Java', 'TypeScript', 'Go', 'Rust', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin',
            // Web Technologies  
            'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel',
            // Databases
            'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB',
            // Cloud & DevOps
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'Terraform', 'Ansible',
            // Data & ML
            'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn',
            // Other Technologies
            'API', 'REST', 'GraphQL', 'Microservices', 'Kafka', 'RabbitMQ', 'Git', 'Linux', 'Agile', 'Scrum'
        ];
        
        const foundSkills = [];
        const resumeLower = this.resumeText.toLowerCase();
        
        technicalTerms.forEach(term => {
            if (resumeLower.includes(term.toLowerCase())) {
                foundSkills.push(term);
            }
        });
        
        return [...new Set(foundSkills)];
    }

    // Extract quantified experiences and achievements
    extractQuantifiedExperiences() {
        const patterns = [
            // Metrics with percentages, numbers, users
            /[•\-*]?\s*([^\n]*(?:\d+%|\d+x|\d+\+|\d+K|\d+M|\d+ users?|\d+ records?|\d+ projects?|\d+ systems?|improved|increased|reduced|built|developed|implemented|designed|optimized)[^\n]{10,150})/gi,
            // Project descriptions with technical details
            /([^.\n]*(?:built|developed|created|implemented|designed|architected)[^.\n]*(?:using|with|in|via)[^.\n]*(?:Python|JavaScript|SQL|React|API|system|platform|application)[^.\n]{10,200})/gi
        ];
        
        const experiences = [];
        patterns.forEach(pattern => {
            const matches = this.resumeText.match(pattern) || [];
            matches.forEach(match => {
                const clean = match.replace(/^[•\-*\s]+/, '').trim();
                if (clean.length > 30 && clean.length < 300) {
                    experiences.push(clean);
                }
            });
        });
        
        // Remove duplicates and get top 4
        return [...new Set(experiences)].slice(0, 4);
    }

    // Extract job requirements
    extractJobRequirements() {
        // Look for requirements section
        const reqSection = this.jobDescription.match(/(?:Requirements|Qualifications|Must Have|Essential|You Have)[\s\S]*?(?=(?:Nice|Preferred|Bonus|Benefits|About|Company|What We|$))/i);
        
        if (reqSection) {
            return reqSection[0];
        }
        
        // Fallback: return first 400 characters
        return this.jobDescription.substring(0, 400);
    }

    // Generate Perplexity-style cover letter using ACTUAL user data
    generatePerplexityStyleCoverLetter(resumeData, jobData, analysis) {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        console.log('Generating cover letter with real data:');
        console.log('Resume data:', resumeData);
        console.log('Job data:', jobData);
        console.log('Analysis foundKeywords:', analysis.foundKeywords);
        console.log('Analysis matchScore:', analysis.matchScore);
        
        // Use REAL extracted data, not placeholder data
        const userName = resumeData.name !== '[Your Name]' ? resumeData.name : 'Your Name';
        const userEmail = resumeData.email !== 'your.email@example.com' ? resumeData.email : 'your.email@example.com';
        const userPhone = resumeData.phone !== '[Your Phone]' ? resumeData.phone : 'Your Phone';
        const jobTitle = jobData.position !== 'the advertised position' ? jobData.position : 'the advertised position';
        const companyName = jobData.company !== 'the company' ? jobData.company : 'the company';
        
        // Extract REAL technical skills from analysis
        const matchedSkills = analysis.foundKeywords && analysis.foundKeywords.length > 0 ? 
            analysis.foundKeywords.slice(0, 6) : resumeData.skills.slice(0, 6);
        
        // Build opening paragraph with REAL skills
        const topSkills = matchedSkills.slice(0, 3).join(', ') || 'technical expertise';
        
        // Get actual experience from resume text
        const experiences = this.extractRealExperiences(this.resumeText);
        const topExperience = experiences.length > 0 ? experiences[0] : 
            `hands-on experience with ${topSkills}`;
            
        // Get actual education level
        const educationLevel = this.resumeText.toLowerCase().includes('master') || 
                             this.resumeText.toLowerCase().includes('m.s.') || 
                             this.resumeText.toLowerCase().includes('ms ') ? 
                             'graduate' : 'professional';
        
        // Header with REAL contact info
        const header = `${userName}
${userEmail} | LinkedIn | GitHub
${today}

Hiring Team
${companyName}

Dear Hiring Team,`;

        // Paragraph 1: Hook + Real Experience Connection
        const paragraph1 = `As a ${educationLevel} with ${topExperience}, I was excited to find ${companyName}'s ${jobTitle} role. My experience with ${topSkills}—demonstrated through ${this.getBestProjectExample()}—aligns perfectly with your need for ${this.extractKeyRequirement(jobData.requirements)} at ${companyName} scale.`;

        // Paragraph 2: Real Technical Achievements
        const technicalDetails = this.formatRealTechnicalWork(experiences, matchedSkills);
        const paragraph2 = `In my recent work, I've ${technicalDetails}. This required expertise in ${matchedSkills.join(', ')}, ${this.extractSoftSkills(jobData.requirements)}, and ${this.getCollaborationSkills()}—directly aligning with ${this.getJobAlignment(jobData.requirements)}.`;

        // Paragraph 3: Value Proposition + Call to Action  
        const ongoingWork = this.getActualOngoingProject();
        const paragraph3 = `${companyName}'s mission to ${this.getCompanyMission(companyName)} resonates with me. ${ongoingWork} I'm excited to bring my ${matchedSkills.slice(0, 2).join(' and ')} expertise to your team and contribute to ${companyName}'s continued innovation. Let's discuss how my ${analysis.matchScore}% skill match can drive impact!`;

        const closing = `Best,
${userName}`;

        return `${header}

${paragraph1}

${paragraph2}

${paragraph3}

${closing}`;
    }

    // Extract REAL experiences with achievements from resume text
    extractRealExperiences(resumeText) {
        const experiencePatterns = [
            // Bullet points with achievements
            /[•\-*]\s*([^.\n]*(?:\d+%|\d+\+|\d+ users?|\d+ projects?|improved|increased|reduced|built|developed|created|implemented)[^.\n]{15,200})/gi,
            // Achievement sentences
            /([^.\n]*(?:achieved|developed|built|created|implemented|designed|led|managed)[^.\n]*(?:\d+%|\d+\+|\d+ users?|improvement|increase|reduction)[^.\n]{15,200})/gi,
            // Technical project descriptions
            /([^.\n]*(?:Python|JavaScript|SQL|React|API|database|system|platform|application)[^.\n]*(?:built|developed|created|implemented)[^.\n]{15,200})/gi
        ];
        
        const experiences = [];
        experiencePatterns.forEach(pattern => {
            const matches = resumeText.match(pattern) || [];
            matches.forEach(match => {
                const clean = match.replace(/^[•\-*\s]+/, '').trim();
                if (clean.length > 20 && !experiences.includes(clean)) {
                    experiences.push(clean);
                }
            });
        });
        
        return experiences.slice(0, 5);
    }

    // Format real technical work from experiences
    formatRealTechnicalWork(experiences, skills) {
        if (experiences.length > 0) {
            return `delivered ${experiences[0]}, ${experiences[1] || 'implemented scalable solutions'}, and ${experiences[2] || 'optimized system performance'}`;
        }
        
        return `architected production systems using ${skills.slice(0, 3).join(', ')}, delivered scalable solutions with measurable impact, and optimized performance across multiple platforms`;
    }

    // Get the best project example from resume
    getBestProjectExample() {
        const projectKeywords = ['project', 'system', 'platform', 'application', 'tool', 'service'];
        const resumeLines = this.resumeText.split('\n');
        
        for (const line of resumeLines) {
            if (projectKeywords.some(keyword => line.toLowerCase().includes(keyword)) && 
                line.length > 20 && line.length < 150) {
                return line.trim().replace(/^[•\-*\s]+/, '');
            }
        }
        
        return 'scalable systems processing high-volume data with optimal performance';
    }

    // Extract key requirement from job description
    extractKeyRequirement(requirements) {
        const keyPhrases = [
            'scalable systems', 'data pipelines', 'production systems', 'high-performance',
            'distributed systems', 'cloud infrastructure', 'data processing', 'system design',
            'software development', 'technical solutions'
        ];
        
        const reqLower = requirements.toLowerCase();
        for (const phrase of keyPhrases) {
            if (reqLower.includes(phrase)) {
                return phrase;
            }
        }
        
        return 'technical excellence and scalable solutions';
    }

    // Extract soft skills from job requirements
    extractSoftSkills(requirements) {
        const softSkills = ['collaboration', 'leadership', 'communication', 'problem-solving', 'analytical thinking'];
        const reqLower = requirements.toLowerCase();
        
        const found = softSkills.filter(skill => reqLower.includes(skill));
        return found.length > 0 ? found.slice(0, 2).join(' and ') : 'cross-functional collaboration';
    }

    // Get collaboration skills
    getCollaborationSkills() {
        return 'cross-team coordination with stakeholders and technical teams';
    }

    // Get actual ongoing project
    getActualOngoingProject() {
        const ongoingProjects = this.detectOngoingProjects(this.resumeText);
        if (ongoingProjects.length > 0) {
            const project = ongoingProjects[0];
            return `Currently, I'm developing ${project.name}, which has ${project.metrics.join(' and ') || 'demonstrated measurable impact'}.`;
        }
        
        // Look for current work indicators in resume
        if (this.resumeText.toLowerCase().includes('current') || 
            this.resumeText.toLowerCase().includes('present') ||
            this.resumeText.toLowerCase().includes('2026')) {
            return 'Through my current project work, I\'ve demonstrated the ability to deliver production-scale solutions.';
        }
        
        return 'My recent project experience has equipped me with production-ready skills.';
    }

    // Helper methods for Perplexity-style content
    getScaleReference(company) {
        const scaleMap = {
            'meta': 'Facebook-scale',
            'google': 'Google-scale', 
            'amazon': 'Amazon-scale',
            'microsoft': 'enterprise-scale',
            'apple': 'consumer-scale',
            'netflix': 'streaming-scale'
        };
        
        return scaleMap[company.toLowerCase()] || 'enterprise-scale';
    }

    getBusinessContext(company) {
        const contextMap = {
            'meta': 'massive user engagement',
            'google': 'global search and cloud infrastructure', 
            'amazon': 'worldwide e-commerce operations',
            'netflix': 'global streaming experiences',
            'uber': 'real-time transportation networks'
        };
        
        return contextMap[company.toLowerCase()] || 'critical business operations';
    }

    formatAchievements(experiences) {
        if (experiences.length === 0) {
            return 'scalable data pipelines (99% uptime), ML prediction services (90%+ accuracy), and automated workflows reducing processing time 30%';
        }
        
        return experiences.slice(0, 3).join(', ').replace(/[•\-*]/g, '').trim();
    }

    extractWorkplace() {
        const workMatch = this.resumeText.match(/(?:at|@)\s+([A-Z][A-Za-z\s&.,]+?)(?:\s*,|\s*\n|\s*\|)/);
        return workMatch ? workMatch[1].trim() : null;
    }

    getJobAlignment(requirements) {
        // Extract key responsibilities from requirements
        if (requirements.includes('data')) return 'data architecture, analytics, and warehouse management for product growth';
        if (requirements.includes('software')) return 'software architecture, system design, and product development lifecycle';
        if (requirements.includes('machine learning')) return 'ML pipeline development, model deployment, and production optimization';
        
        return 'system architecture, technical leadership, and cross-functional collaboration';
    }

    getCompanyMission(company) {
        const missionMap = {
            'meta': 'connect people through innovative social experiences',
            'google': 'organize the world\'s information',
            'amazon': 'be Earth\'s most customer-centric company',
            'netflix': 'entertain the world'
        };
        
        return missionMap[company.toLowerCase()] || 'drive innovation and growth';
    }

    getCulturalTraits() {
        return 'fast-paced, curious';
    }

    getOngoingProjectSummary() {
        const ongoingProjects = this.detectOngoingProjects(this.resumeText);
        if (ongoingProjects.length > 0) {
            const project = ongoingProjects[0];
            const metrics = project.metrics.slice(0, 2).join(' and ') || '100+ users';
            return `Currently, I'm developing ${project.name}, serving ${metrics} and demonstrating production-scale impact.`;
        }
        
        return 'Through self-driven projects serving 100+ users, I\'ve demonstrated production-scale thinking.';
    }

    buildPersonalizedCoverLetter(analysis, resumeInsights, jobInsights, tone) {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Get tone-specific language
        const toneLanguage = this.getToneLanguage(tone);
        
        // Build header
        const header = `${resumeInsights.name}\n${resumeInsights.email} | ${resumeInsights.phone}\n\n${today}\n\nDear Hiring Manager,`;
        
        // Build opening paragraph
        const opening = this.buildOpeningParagraph(jobInsights, toneLanguage);
        
        // Build skills and experience paragraph
        const skillsParagraph = this.buildSkillsParagraph(analysis, resumeInsights, jobInsights, toneLanguage);
        
        // Build value proposition paragraph
        const valueParagraph = this.buildValueParagraph(analysis, resumeInsights, toneLanguage);
        
        // Build closing
        const closing = this.buildClosingParagraph(toneLanguage);
        
        return `${header}\n\n${opening}\n\n${skillsParagraph}\n\n${valueParagraph}\n\n${closing}`;
    }

    toggleAIMode() {
        const isAIMode = document.getElementById('aiModeToggle').checked;
        const freeModeInfo = document.getElementById('freeModeInfo');
        const aiModeSection = document.getElementById('aiModeSection');
        const toggleLabel = document.querySelector('.slider');
        
        if (isAIMode) {
            freeModeInfo.style.display = 'none';
            aiModeSection.style.display = 'block';
            toggleLabel.textContent = 'AI';
        } else {
            freeModeInfo.style.display = 'block';
            aiModeSection.style.display = 'none';
            toggleLabel.textContent = 'Free';
        }
    }

    saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showNotification('Please enter a valid API key', 'error');
            return;
        }
        
        // Save to localStorage
        localStorage.setItem('llm_api_key', apiKey);
        
        // Visual feedback
        apiKeyInput.style.backgroundColor = '#ecfdf5';
        apiKeyInput.style.borderColor = '#4caf50';
        setTimeout(() => {
            apiKeyInput.style.backgroundColor = '';
            apiKeyInput.style.borderColor = '';
        }, 2000);
        
        this.showNotification('API key saved securely!', 'success');
    }
    
    loadSavedApiKey() {
        const savedKey = localStorage.getItem('llm_api_key');
        if (savedKey) {
            const apiKeyInput = document.getElementById('apiKeyInput');
            if (apiKeyInput) {
                apiKeyInput.value = savedKey;
            }
        }
    }

    extractJobTitle() {
        const titlePatterns = [
            /^([A-Z][A-Za-z\s-]+(?:Developer|Engineer|Manager|Analyst|Scientist|Specialist|Lead|Director))/m,
            /Position:\s*([A-Z][A-Za-z\s-]+)/i,
            /Role:\s*([A-Z][A-Za-z\s-]+)/i,
            /hiring.*?([A-Z][A-Za-z\s-]+(?:Developer|Engineer|Manager|Analyst|Scientist))/i
        ];

        for (let pattern of titlePatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1].length < 80) {
                return match[1].trim();
            }
        }
        return 'Software Engineer';
    }

    extractCompanyName() {
        const companyPatterns = [
            /at ([A-Z][A-Za-z\s&]+)(?:,|\.|$)/,
            /join ([A-Z][A-Za-z\s&]+)(?:'s|$)/,
            /([A-Z][A-Za-z\s&]+) is (?:seeking|looking|hiring)/,
        ];
        
        for (let pattern of companyPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1].length < 50) {
                return match[1].trim();
            }
        }
        return 'Company';
    }

    buildOpeningParagraph(jobInsights, toneLanguage) {
        const position = jobInsights.position !== 'this position' ? jobInsights.position : 'the advertised position';
        const company = jobInsights.company !== 'the organization' ? ` at ${jobInsights.company}` : '';
        
        return `${toneLanguage.opening} the ${position}${company}. With my technical background and proven track record in software development, I believe I would be a valuable addition to your team.`;
    }

    buildSkillsParagraph(analysis, resumeInsights, jobInsights, toneLanguage) {
        const topSkills = analysis.foundKeywords.slice(0, 5);
        const skillsText = topSkills.length > 0 ? topSkills.join(', ') : 'relevant technologies';
        
        let paragraph = `${toneLanguage.confidence} ${skillsText} makes me well-suited for this role.`;
        
        // Add specific experience if available
        if (resumeInsights.experiences && resumeInsights.experiences.length > 0) {
            const bestExperience = resumeInsights.experiences[0];
            paragraph += ` In my previous work, ${bestExperience.toLowerCase()}.`;
        }
        
        // Mention education if relevant
        if (resumeInsights.education) {
            paragraph += ` My educational background in ${resumeInsights.education} provides a strong foundation for the technical challenges in this position.`;
        }
        
        return paragraph;
    }

    buildValueParagraph(analysis, resumeInsights, toneLanguage) {
        const matchPercentage = analysis.matchScore;
        
        let paragraph = `${toneLanguage.enthusiasm} it combines technical challenges with opportunities for professional growth.`;
        
        // Add value proposition based on match score
        if (matchPercentage >= 70) {
            paragraph += ` My skills align strongly with your requirements, and I\'m eager to contribute to your projects from day one.`;
        } else {
            paragraph += ` I\'m excited to bring my unique perspective and learn new technologies that will help me excel in this role.`;
        }
        
        // Add closing strength
        if (resumeInsights.experiences && resumeInsights.experiences.length > 1) {
            paragraph += ` My track record of delivering results and working effectively in team environments positions me to make meaningful contributions to your organization.`;
        }
        
        return paragraph;
    }

    buildClosingParagraph(toneLanguage) {
        return `${toneLanguage.closing} Thank you for your time and consideration. I look forward to hearing from you.\n\nBest regards,\n[Your Name]`;
    }

    extractResumeInsights() {
        if (!this.resumeText || this.resumeText.length < 10) {
            return {
                name: '[Your Name]',
                email: '[Your Email]',
                phone: '[Your Phone]',
                experiences: [],
                education: null,
                technicalSkills: []
            };
        }

        try {
            // Extract name from resume
            const nameMatch = this.resumeText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/m) || 
                             this.resumeText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
            const name = nameMatch ? nameMatch[1].trim() : '[Your Name]';

            // Extract contact info
            const emailMatch = this.resumeText.match(/[\w.-]+@[\w.-]+\.\w+/);
            const phoneMatch = this.resumeText.match(/[\(\d\-\.\s\)]{10,}/);
            
            // Extract work experiences with quantifiable achievements
            const experiences = this.extractWorkExperiences();
            
            // Extract education
            const educationMatch = this.resumeText.match(/(Bachelor|Master|PhD).*?(Computer Science|Engineering|Science|Technology)/gi);
            const education = educationMatch ? educationMatch[0] : null;

            // Extract technical skills mentioned in resume
            const technicalSkills = this.extractKeywords(this.resumeText);
            
            return {
                name,
                email: emailMatch ? emailMatch[0] : '[Your Email]',
                phone: phoneMatch ? phoneMatch[0].trim() : '[Your Phone]',
                experiences,
                education,
                technicalSkills
            };
        } catch (error) {
            console.error('Error extracting resume insights:', error);
            return {
                name: '[Your Name]',
                email: '[Your Email]',
                phone: '[Your Phone]',
                experiences: [],
                education: null,
                technicalSkills: []
            };
        }
    }

    getToneLanguage(tone) {
        const toneMap = {
            professional: {
                opening: 'I am writing to express my strong interest in',
                confidence: 'I am confident that my experience in',
                enthusiasm: 'I am particularly drawn to this opportunity because',
                closing: 'I would welcome the opportunity to discuss how my background can contribute to your team.'
            },
            enthusiastic: {
                opening: 'I am excited to apply for',
                confidence: 'I\'m thrilled that my background in',
                enthusiasm: 'What excites me most about this role is',
                closing: 'I would love the chance to bring my passion and skills to your dynamic team!'
            },
            formal: {
                opening: 'I hereby submit my application for the position of',
                confidence: 'My professional background demonstrates expertise in',
                enthusiasm: 'This position aligns perfectly with my career objectives because',
                closing: 'I respectfully request the opportunity to discuss my qualifications in person.'
            },
            conversational: {
                opening: 'I\'d love to throw my hat in the ring for',
                confidence: 'My experience working with',
                enthusiasm: 'What really appeals to me about this role is',
                closing: 'I\'d be happy to chat more about how I can help your team succeed.'
            }
        };
        return toneMap[tone] || toneMap.professional;
    }

    getFallbackCoverLetter() {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        return `[Your Name]
[Your Email] | [Your Phone]

${today}

Dear Hiring Manager,

I am writing to express my strong interest in the position advertised. Based on my analysis of the job requirements and my background, I believe I would be a valuable addition to your team.

My experience includes working with various technologies and frameworks that align with your requirements. I am particularly excited about the opportunity to contribute to your organization's goals and continue growing professionally in this role.

I have demonstrated ability to work effectively in team environments and deliver high-quality results. My technical skills combined with my problem-solving abilities make me well-suited for this position.

I would welcome the opportunity to discuss how my background and enthusiasm can contribute to your team's success. Thank you for your time and consideration.

Best regards,
[Your Name]

---
💡 This is a fallback template. For a personalized cover letter, please ensure both resume and job description are provided.`;
    }

    extractResumeInsights() {
        if (!this.resumeText || this.resumeText.length < 10) {
            return {
                name: '[Your Name]',
                email: '[Your Email]',
                phone: '[Your Phone]',
                experiences: [],
                education: null,
                technicalSkills: []
            };
        }

        try {
            // Extract name from resume
            const nameMatch = this.resumeText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/m) || 
                             this.resumeText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
            const name = nameMatch ? nameMatch[1].trim() : '[Your Name]';

            // Extract contact info
            const emailMatch = this.resumeText.match(/[\w.-]+@[\w.-]+\.\w+/);
            const phoneMatch = this.resumeText.match(/[\(\d\-\.\s\)]{10,}/);
            
            // Extract work experiences with quantifiable achievements
            const experiences = this.extractWorkExperiences();
            
            // Extract education
            const educationMatch = this.resumeText.match(/(Bachelor|Master|PhD).*?(Computer Science|Engineering|Science|Technology)/gi);
            const education = educationMatch ? educationMatch[0] : null;

            // Extract technical skills mentioned in resume
            const technicalSkills = this.extractKeywords(this.resumeText);
            
            return {
                name,
                email: emailMatch ? emailMatch[0] : '[Your Email]',
                phone: phoneMatch ? phoneMatch[0].trim() : '[Your Phone]',
                experiences,
                education,
                technicalSkills
            };
        } catch (error) {
            console.error('Error extracting resume insights:', error);
            return {
                name: '[Your Name]',
                email: '[Your Email]',
                phone: '[Your Phone]',
                experiences: [],
                education: null,
                technicalSkills: []
            };
        }
    }

    extractWorkExperiences() {
        try {
            if (!this.resumeText || this.resumeText.length < 10) {
                return [];
            }

            const experiences = [];
            
            // Look for quantifiable achievements (numbers, percentages, etc.)
            const achievementPatterns = [
                /[^\.\n]*(\d+%|\d+x|[+-]\d+%)[^\.\n]*/gi,
                /[^\.\n]*(\d+\+?\s*(?:users|customers|projects|systems|applications|records))[^\.\n]*/gi,
                /[^\.\n]*(?:improved|increased|reduced|optimized|built|developed|implemented|designed|led)[^\.\n]*(\d+[%x]?)[^\.\n]*/gi,
                /[^\.\n]*(?:managed|handled|processed)[^\.\n]*(\d+\+?)[^\.\n]*/gi
            ];

            // Extract sentences with achievements
            const sentences = this.resumeText.split(/[.•·\-*\n]/).filter(s => s.trim().length > 20);
            
            sentences.forEach(sentence => {
                achievementPatterns.forEach(pattern => {
                    const matches = sentence.match(pattern);
                    if (matches && matches[0]) {
                        const cleanSentence = matches[0].trim();
                        if (cleanSentence.length > 15 && cleanSentence.length < 200) {
                            experiences.push(cleanSentence);
                        }
                    }
                });
            });

            // Remove duplicates and return top achievements
            return [...new Set(experiences)].slice(0, 4);
            
        } catch (error) {
            console.error('Error extracting work experiences:', error);
            return [];
        }
    }

    extractJobInsights() {
        // Extract company name more intelligently
        const companyPatterns = [
            /at ([A-Z][A-Za-z\s&]+)(?:,|\.|$)/,
            /join ([A-Z][A-Za-z\s&]+)(?:'s|$)/,
            /([A-Z][A-Za-z\s&]+) is (?:seeking|looking|hiring)/,
        ];
        
        let company = 'the organization';
        for (let pattern of companyPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1].length < 50) {
                company = match[1].trim();
                break;
            }
        }

        // Extract position title more accurately
        const titlePatterns = [
            /^([A-Z][A-Za-z\s-]+(?:Developer|Engineer|Manager|Analyst|Scientist|Specialist|Lead|Director))/m,
            /Position:\s*([A-Z][A-Za-z\s-]+)/i,
            /Role:\s*([A-Z][A-Za-z\s-]+)/i,
            /hiring.*?([A-Z][A-Za-z\s-]+(?:Developer|Engineer|Manager|Analyst|Scientist))/i
        ];

        let position = 'this position';
        for (let pattern of titlePatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1].length < 80) {
                position = match[1].trim();
                break;
            }
        }

        // Extract key technologies/skills required
        const requiredSkills = this.extractKeywords(this.jobDescription);

        // Extract years of experience required
        const experienceMatch = this.jobDescription.match(/(\d+)\+?\s*years?\s*(?:of\s*)?experience/i);
        const yearsRequired = experienceMatch ? experienceMatch[1] : null;

        return {
            company,
            position,
            requiredSkills,
            yearsRequired
        };
    }

    createProfessionalCoverLetter(analysis, resumeInsights, jobInsights) {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Find matching skills between resume and job
        const matchingSkills = analysis.foundKeywords;
        const missingSkills = analysis.missingKeywords.slice(0, 3); // Top 3 missing

        // Create compelling opening
        const openingLine = this.getEngagingOpening(jobInsights.position, jobInsights.company);
        
        // Create skill alignment paragraph
        const skillAlignment = this.createSkillAlignment(matchingSkills, resumeInsights.technicalSkills);
        
        // Create achievement showcase
        const achievementShowcase = this.createAchievementShowcase(resumeInsights.experiences, jobInsights);
        
        // Create ongoing project impact statement
        const ongoingProjects = this.detectOngoingProjects(this.resumeText);
        const projectImpact = this.createProjectImpactStatement(ongoingProjects, matchingSkills);
        
        // Create value proposition
        const valueProposition = this.createValueProposition(analysis, jobInsights);

        return `${resumeInsights.name}
${resumeInsights.email} | ${resumeInsights.phone}

${today}

Hiring Manager
${jobInsights.company}

Dear Hiring Manager,

${openingLine}

${skillAlignment}

${achievementShowcase}${projectImpact ? '\n\n' + projectImpact : ''}

${valueProposition}

I am excited about the opportunity to bring my expertise in ${matchingSkills.slice(0, 3).join(', ')} to ${jobInsights.company} and contribute to your team's continued success. I would welcome the chance to discuss how my background aligns with your needs and how I can help drive your projects forward.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
${resumeInsights.name}

---
💡 This cover letter was intelligently generated based on your resume content and job requirements.
Match Score: ${analysis.matchScore}% | ${matchingSkills.length} skills matched${missingSkills.length > 0 ? ` | Consider highlighting: ${missingSkills.join(', ')}` : ''}`;
    }

    getEngagingOpening(position, company) {
        const openings = [
            `I am thrilled to apply for the ${position} role at ${company}. With my proven track record in software development and passion for innovative technology solutions, I am confident I would be a valuable addition to your team.`,
            
            `Your ${position} opening at ${company} represents exactly the kind of challenge I've been seeking. My comprehensive background in modern development practices and commitment to excellence make me an ideal candidate for this role.`,
            
            `I am writing to express my strong interest in the ${position} position at ${company}. Having analyzed your requirements, I am excited about the opportunity to contribute my technical expertise and drive meaningful impact within your organization.`
        ];
        
        return openings[Math.floor(Math.random() * openings.length)];
    }

    createSkillAlignment(matchingSkills, resumeSkills) {
        if (matchingSkills.length === 0) {
            return `My technical foundation provides a strong base for this role, with experience in various programming languages and development frameworks that would allow me to quickly adapt to your technology stack.`;
        }

        const topSkills = matchingSkills.slice(0, 5);
        const ongoingProjects = this.detectOngoingProjects(this.resumeText);
        
        let alignment = `My technical expertise directly aligns with your requirements. I bring hands-on experience with ${topSkills.join(', ')}, positioning me to make immediate contributions to your projects.`;
        
        // Incorporate ongoing project if detected
        if (ongoingProjects.length > 0) {
            const primaryProject = ongoingProjects[0];
            const metrics = primaryProject.metrics.slice(0, 2).join(', ');
            alignment += ` Currently, I'm developing ${primaryProject.name}, where I'm implementing ${topSkills.slice(0, 2).join(' and ')} to serve ${metrics ? metrics + ' demonstrating' : 'users, demonstrating'} production-scale experience directly relevant to your technical requirements.`;
        }
        
        return alignment + ` This technical proficiency, combined with my problem-solving approach, enables me to tackle complex challenges effectively.`;
    }

    createProjectImpactStatement(ongoingProjects, matchingSkills) {
        if (ongoingProjects.length === 0) return '';
        
        const project = ongoingProjects[0];
        const techStack = matchingSkills.filter(skill => 
            project.details.some(detail => detail.toLowerCase().includes(skill.toLowerCase()))
        ).slice(0, 3);
        
        const metrics = project.metrics.slice(0, 2);
        const metricsText = metrics.length > 0 ? `achieving ${metrics.join(' and ')}` : 'serving production users';
        
        return `Beyond my professional experience, I'm currently developing ${project.name}, implementing ${techStack.join(', ')} and ${metricsText}—demonstrating my ability to deliver scalable solutions and drive innovation in real-world applications.`;
    }

    createAchievementShowcase(experiences, jobInsights) {
        if (experiences.length === 0) {
            return `In my previous roles, I have consistently delivered high-quality solutions while working collaboratively in fast-paced environments. I have experience building scalable applications, optimizing system performance, and contributing to cross-functional teams to achieve project objectives.`;
        }

        const topAchievements = experiences.slice(0, 3);
        return `My track record demonstrates measurable impact in previous roles:

${topAchievements.map(achievement => `• ${achievement}`).join('\n')}

These accomplishments reflect my ability to deliver results and drive improvements, qualities that would directly benefit ${jobInsights.company}'s objectives.`;
    }

    createValueProposition(analysis, jobInsights) {
        const matchPercentage = analysis.matchScore;
        
        if (matchPercentage >= 70) {
            return `With a ${matchPercentage}% alignment to your requirements, I represent a strong technical fit for this role. Beyond the technical skills, I bring a collaborative mindset, continuous learning attitude, and dedication to code quality that would enhance your development team's capabilities.`;
        } else if (matchPercentage >= 50) {
            return `While building my expertise in some of the specific technologies mentioned in your posting, my strong foundation in software development principles, combined with my proven ability to quickly master new technologies, positions me to excel in this role and grow with ${jobInsights.company}.`;
        } else {
            return `I am particularly drawn to this role because it represents an excellent opportunity to apply my core development skills while expanding my expertise in your technology stack. My adaptability, strong learning capacity, and passion for technology make me well-suited to grow into this position.`;
        }
    }

    createBasicCoverLetter() {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        return `[Your Name]
[Your Email] | [Your Phone Number]

${today}

Hiring Manager
[Company Name]

Dear Hiring Manager,

I am writing to express my strong interest in the position advertised by your organization. After reviewing the job description, I am excited about the opportunity to contribute my skills and experience to your team.

My technical background and professional experience align well with the requirements outlined in your posting. I have developed expertise in various programming languages, frameworks, and development methodologies that would enable me to make meaningful contributions to your projects.

Key strengths I would bring to this role include:
• Strong problem-solving abilities and analytical thinking
• Experience with modern development practices and tools
• Collaborative approach to working in team environments  
• Commitment to continuous learning and professional growth
• Proven ability to deliver high-quality results under deadlines

I am particularly drawn to this opportunity because it represents a chance to apply my technical skills while continuing to grow professionally. I would welcome the opportunity to discuss how my background and enthusiasm can contribute to your team's success.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
[Your Name]

---
💡 To get a personalized cover letter, ensure both your resume and the complete job description are uploaded.`;
    }

    extractWorkExperiences() {
        try {
            if (!this.resumeText || this.resumeText.length < 10) {
                return [];
            }

            const experiences = [];
            
            // Look for quantifiable achievements (numbers, percentages, etc.)
            const achievementPatterns = [
                /[^\.\n]*(\d+%|\d+x|[+-]\d+%)[^\.\n]*/gi,
                /[^\.\n]*(\d+\+?\s*(?:users|customers|projects|systems|applications|records))[^\.\n]*/gi,
                /[^\.\n]*(?:improved|increased|reduced|optimized|built|developed|implemented|designed|led)[^\.\n]*(\d+[%x]?)[^\.\n]*/gi,
                /[^\.\n]*(?:managed|handled|processed)[^\.\n]*(\d+\+?)[^\.\n]*/gi
            ];

            // Extract sentences with achievements
            const sentences = this.resumeText.split(/[.•·\-*\n]/).filter(s => s.trim().length > 20);
            
            sentences.forEach(sentence => {
                achievementPatterns.forEach(pattern => {
                    const matches = sentence.match(pattern);
                    if (matches && matches[0]) {
                        const cleanSentence = matches[0].trim();
                        if (cleanSentence.length > 15 && cleanSentence.length < 200) {
                            experiences.push(cleanSentence);
                        }
                    }
                });
            });

            // Remove duplicates and return top achievements
            return [...new Set(experiences)].slice(0, 4);
            
        } catch (error) {
            console.error('Error extracting work experiences:', error);
            return [];
        }
    }

    extractJobInsights() {
        // Extract company name more intelligently
        const companyPatterns = [
            /at ([A-Z][A-Za-z\s&]+)(?:,|\.|$)/,
            /join ([A-Z][A-Za-z\s&]+)(?:'s|$)/,
            /([A-Z][A-Za-z\s&]+) is (?:seeking|looking|hiring)/,
        ];
        
        let company = 'the organization';
        for (let pattern of companyPatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1].length < 50) {
                company = match[1].trim();
                break;
            }
        }

        // Extract position title more accurately
        const titlePatterns = [
            /^([A-Z][A-Za-z\s-]+(?:Developer|Engineer|Manager|Analyst|Scientist|Specialist|Lead|Director))/m,
            /Position:\s*([A-Z][A-Za-z\s-]+)/i,
            /Role:\s*([A-Z][A-Za-z\s-]+)/i,
            /hiring.*?([A-Z][A-Za-z\s-]+(?:Developer|Engineer|Manager|Analyst|Scientist))/i
        ];

        let position = 'this position';
        for (let pattern of titlePatterns) {
            const match = this.jobDescription.match(pattern);
            if (match && match[1].length < 80) {
                position = match[1].trim();
                break;
            }
        }

        // Extract key technologies/skills required
        const requiredSkills = this.extractKeywords(this.jobDescription);

        // Extract years of experience required
        const experienceMatch = this.jobDescription.match(/(\d+)\+?\s*years?\s*(?:of\s*)?experience/i);
        const yearsRequired = experienceMatch ? experienceMatch[1] : null;

        return {
            company,
            position,
            requiredSkills,
            yearsRequired
        };
    }
    
    copyLetter() {
        const textArea = document.getElementById('coverLetterText');
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            this.showNotification('Cover letter copied to clipboard!', 'success');
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(textArea.value).then(() => {
                this.showNotification('Cover letter copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy. Please select and copy manually.', 'error');
            });
        }
    }
    
    regenerateLetter() {
        this.generateCoverLetter();
    }
    
    toggleEditMode() {
        const textArea = document.getElementById('coverLetterText');
        const editBtn = document.getElementById('editLetter');
        
        if (textArea.readOnly) {
            textArea.readOnly = false;
            textArea.style.background = '#fffbf0';
            editBtn.textContent = '✅ Save';
            editBtn.style.background = 'var(--success-color)';
            this.showNotification('Edit mode enabled', 'success');
        } else {
            textArea.readOnly = true;
            textArea.style.background = 'var(--card-background)';
            editBtn.textContent = '✏️ Edit Mode';
            editBtn.style.background = '';
            this.showNotification('Changes saved', 'success');
        }
    }
    
    updateLetterStats() {
        const textArea = document.getElementById('coverLetterText');
        const text = textArea.value;
        
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        const charCount = text.length;
        
        document.getElementById('wordCount').textContent = `${wordCount} words`;
        document.getElementById('charCount').textContent = `${charCount} characters`;
    }
    
    downloadLetter() {
        const content = document.getElementById('coverLetterText').value;
        if (!content.trim()) {
            this.showNotification('No cover letter to download', 'error');
            return;
        }
        
        try {
            // Create PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set up PDF formatting
            const margin = 20;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const maxLineWidth = pageWidth - (margin * 2);
            
            // Split content into lines that fit the page width
            const lines = content.split('\n');
            const wrappedLines = [];
            
            lines.forEach(line => {
                if (line.trim() === '') {
                    wrappedLines.push('');
                } else {
                    const splitLines = doc.splitTextToSize(line, maxLineWidth);
                    wrappedLines.push(...splitLines);
                }
            });
            
            // Add text to PDF with proper spacing
            let yPosition = margin;
            const lineHeight = 6;
            
            wrappedLines.forEach((line, index) => {
                // Check if we need a new page
                if (yPosition > pageHeight - margin - lineHeight) {
                    doc.addPage();
                    yPosition = margin;
                }
                
                // Set font style based on content
                if (line.includes('@') || line.includes('Dear') || line.includes('Best regards')) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(11);
                } else if (line.trim() && !line.includes('  ')) {
                    // Headers or names
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                } else {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(11);
                }
                
                doc.text(line, margin, yPosition);
                yPosition += line.trim() === '' ? lineHeight / 2 : lineHeight;
            });
            
            // Generate filename with current date
            const today = new Date().toISOString().split('T')[0];
            const filename = `cover-letter-${today}.pdf`;
            
            // Download the PDF
            doc.save(filename);
            
            this.showNotification('Cover letter downloaded as PDF!', 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showNotification('Error generating PDF. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    buildPersonalizedCoverLetterFromData(resumeData, jobData, analysis, tone) {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Ensure data exists with fallbacks
        const name = resumeData.name || '[Your Name]';
        const email = resumeData.email || 'your.email@example.com';
        const phone = resumeData.phone || '[Your Phone]';
        const position = jobData.position || 'this position';
        const company = jobData.company || 'your organization';
        const skills = resumeData.skills || ['relevant technical skills'];
        const yearsExp = resumeData.yearsOfExperience || '2+';
        
        // Build header with actual resume data
        const header = `${name}
${email} | ${phone}

${today}

Dear Hiring Manager,`;

        // Build opening paragraph with actual job data
        const topSkills = skills.slice(0, 3).join(', ') || 'technical expertise';
        const opening = `I am writing to express my strong interest in the ${position} position at ${company}. With ${yearsExp} years of experience and expertise in ${topSkills}, I am confident I would be a valuable addition to your team.`;

        // Build experience paragraph with ongoing project integration
        const ongoingProjects = this.detectOngoingProjects(this.resumeText);
        let experienceParagraph = '';
        
        if (ongoingProjects.length > 0 && resumeData.experiences.length > 0) {
            const project = ongoingProjects[0];
            const exp = resumeData.experiences[0];
            const metrics = project.metrics.length > 0 ? project.metrics.slice(0, 2).join(' and ') : 'production-level impact';
            experienceParagraph = `My professional background includes ${exp}. Additionally, I'm currently developing ${project.name}, where I've achieved ${metrics}, demonstrating my ability to deliver scalable solutions and drive innovation in real-world applications.`;
        } else if (resumeData.experiences.length > 0) {
            experienceParagraph = `My professional experience includes ${resumeData.experiences[0]}. This background has prepared me well for the challenges described in your ${position} role.`;
        } else {
            experienceParagraph = `My professional background has provided me with comprehensive experience in ${topSkills}. This foundation aligns well with the requirements for your ${position} role.`;
        }

        // Build skills match paragraph using actual analysis data
        const foundKeywords = analysis.foundKeywords || [];
        const matchScore = analysis.matchScore || 70;
        
        let skillsMatch = '';
        if (foundKeywords.length > 0) {
            const relevantSkills = foundKeywords.slice(0, 4).join(', ');
            skillsMatch = `Based on your job requirements, I bring particularly relevant experience in ${relevantSkills}. My background demonstrates a ${matchScore}% match with your technical requirements, positioning me well to contribute immediately to your team's objectives.`;
        } else {
            skillsMatch = `My technical skills in ${topSkills} align well with your requirements, and I'm excited about the opportunity to apply this expertise in a challenging ${position} role.`;
        }

        // Build closing
        const primarySkills = skills.slice(0, 2).join(' and ') || 'technical expertise';
        const closing = `I would welcome the opportunity to discuss how my background in ${primarySkills} can contribute to ${company}'s continued success. Thank you for your consideration.

Sincerely,
${name}`;

        return `${header}\n\n${opening}\n\n${experienceParagraph}\n\n${skillsMatch}\n\n${closing}`;
    }

    buildExperienceParagraph(resumeData, jobData, analysis) {
        if (resumeData.experiences && resumeData.experiences.length > 0) {
            const relevantExp = resumeData.experiences[0]; // Use most recent experience
            return `In my recent role at ${relevantExp.company}, ${relevantExp.description}. This experience has prepared me well for the challenges described in your ${jobData.position} role, particularly in areas such as ${analysis.topMatches.slice(0, 3).join(', ')}.`;
        } else {
            return `My professional background has provided me with comprehensive experience in ${resumeData.skills.slice(0, 3).join(', ')}. This foundation aligns well with the requirements for your ${jobData.position} role, especially in ${analysis.topMatches.slice(0, 3).join(', ')}.`;
        }
    }

    buildFallbackCoverLetter() {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        return `[Your Name]
[Your Email] | [Your Phone]

${today}

Dear Hiring Manager,

I am writing to express my interest in the position at your company. Based on the job description provided, I believe my background and skills make me a strong candidate for this role.

My professional experience has equipped me with the technical skills and knowledge needed to contribute effectively to your team. I am particularly drawn to this opportunity because it aligns well with my career goals and expertise.

I would welcome the opportunity to discuss how my background can contribute to your organization's success. Thank you for your consideration.

Sincerely,
[Your Name]`;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new RecruitReadyAnalyzer();
});