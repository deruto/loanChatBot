const logger = require('../utils/logger');

/**
 * Document requirements matrix based on loan type and employment status
 * This simulates what would typically come from a database or Excel file
 */
class DocumentRequirements {
    constructor() {
        // Document requirements matrix
        this.requirements = {
            'Home': {
                'Salaried': [
                    'Salary Slip (Last 3 months)',
                    'Bank Statement (Last 6 months)',
                    'Form 16 / IT Returns',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Property Documents',
                    'NOC from Builder'
                ],
                'Self-employed': [
                    'ITR (Last 2 years)',
                    'Bank Statement (Last 12 months)',
                    'GST Returns (Last 12 months)',
                    'Business License',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Property Documents',
                    'NOC from Builder',
                    'Business Financial Statements'
                ]
            },
            'Business': {
                'Salaried': [
                    'Salary Slip (Last 3 months)',
                    'Bank Statement (Last 6 months)',
                    'Form 16 / IT Returns',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Business Plan',
                    'Project Report'
                ],
                'Self-employed': [
                    'ITR (Last 3 years)',
                    'Bank Statement (Last 12 months)',
                    'GST Returns (Last 12 months)',
                    'Business License',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Business Plan',
                    'Financial Projections',
                    'Existing Business Financial Statements',
                    'Partnership Deed (if applicable)'
                ]
            },
            'Education': {
                'Salaried': [
                    'Salary Slip (Last 3 months)',
                    'Bank Statement (Last 6 months)',
                    'Form 16 / IT Returns',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Admission Letter',
                    'Fee Structure',
                    'Academic Records'
                ],
                'Self-employed': [
                    'ITR (Last 2 years)',
                    'Bank Statement (Last 12 months)',
                    'Business License',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Admission Letter',
                    'Fee Structure',
                    'Academic Records',
                    'Business Financial Statements'
                ]
            },
            'Personal': {
                'Salaried': [
                    'Salary Slip (Last 3 months)',
                    'Bank Statement (Last 6 months)',
                    'Form 16 / IT Returns',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof'
                ],
                'Self-employed': [
                    'ITR (Last 2 years)',
                    'Bank Statement (Last 12 months)',
                    'GST Returns (if applicable)',
                    'Business License',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Business Financial Statements'
                ]
            },
            'Vehicle': {
                'Salaried': [
                    'Salary Slip (Last 3 months)',
                    'Bank Statement (Last 6 months)',
                    'Form 16 / IT Returns',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Vehicle Quotation',
                    'Driving License'
                ],
                'Self-employed': [
                    'ITR (Last 2 years)',
                    'Bank Statement (Last 12 months)',
                    'Business License',
                    'Identity Proof (Aadhar/PAN)',
                    'Address Proof',
                    'Vehicle Quotation',
                    'Driving License',
                    'Business Financial Statements'
                ]
            }
        };

        // Document descriptions for user guidance
        this.documentDescriptions = {
            'Salary Slip (Last 3 months)': 'Upload your salary slips for the last 3 months',
            'Bank Statement (Last 6 months)': 'Upload bank statements for the last 6 months',
            'Bank Statement (Last 12 months)': 'Upload bank statements for the last 12 months',
            'Form 16 / IT Returns': 'Upload your Form 16 or Income Tax Returns',
            'ITR (Last 2 years)': 'Upload Income Tax Returns for the last 2 years',
            'ITR (Last 3 years)': 'Upload Income Tax Returns for the last 3 years',
            'Identity Proof (Aadhar/PAN)': 'Upload Aadhar Card or PAN Card',
            'Address Proof': 'Upload address proof (Utility bill, Rent agreement, etc.)',
            'GST Returns (Last 12 months)': 'Upload GST returns for the last 12 months',
            'Business License': 'Upload your business registration/license document',
            'Property Documents': 'Upload property-related documents (Sale deed, Agreement, etc.)',
            'NOC from Builder': 'Upload No Objection Certificate from the builder',
            'Business Plan': 'Upload your detailed business plan',
            'Project Report': 'Upload project report with financial details',
            'Financial Projections': 'Upload financial projections for your business',
            'Business Financial Statements': 'Upload profit & loss, balance sheet for your business',
            'Partnership Deed (if applicable)': 'Upload partnership deed if business is a partnership',
            'Admission Letter': 'Upload admission letter from educational institution',
            'Fee Structure': 'Upload fee structure from the institution',
            'Academic Records': 'Upload previous academic records/transcripts',
            'Vehicle Quotation': 'Upload vehicle quotation from dealer',
            'Driving License': 'Upload your valid driving license'
        };

        // Loan type descriptions
        this.loanTypeDescriptions = {
            'Home': 'Home/Housing Loan for purchasing or constructing property',
            'Business': 'Business Loan for starting or expanding business',
            'Education': 'Education Loan for higher studies',
            'Personal': 'Personal Loan for personal expenses',
            'Vehicle': 'Vehicle Loan for purchasing car/bike'
        };

        logger.info('Document requirements service initialized');
    }

    /**
     * Get available loan types
     * @returns {Array} Array of loan type objects
     */
    getAvailableLoanTypes() {
        return Object.keys(this.requirements).map(loanType => ({
            id: loanType.toLowerCase(),
            title: loanType,
            description: this.loanTypeDescriptions[loanType]
        }));
    }

    /**
     * Get available employment types
     * @returns {Array} Array of employment type objects
     */
    getAvailableEmploymentTypes() {
        return [
            {
                id: 'salaried',
                title: 'Salaried',
                description: 'Working as an employee with regular salary'
            },
            {
                id: 'self_employed',
                title: 'Self-employed',
                description: 'Running own business or freelancing'
            }
        ];
    }

    /**
     * Get document requirements for specific loan and employment type
     * @param {string} loanType - Type of loan
     * @param {string} employmentType - Employment type
     * @returns {Array|null} Array of required documents or null if not found
     */
    getRequiredDocuments(loanType, employmentType) {
        try {
            // Normalize inputs
            const normalizedLoanType = this.normalizeLoanType(loanType);
            const normalizedEmploymentType = this.normalizeEmploymentType(employmentType);

            if (!normalizedLoanType || !normalizedEmploymentType) {
                logger.warn(`Invalid loan type or employment type: ${loanType}, ${employmentType}`);
                return null;
            }

            const documents = this.requirements[normalizedLoanType]?.[normalizedEmploymentType];
            
            if (!documents) {
                logger.warn(`No documents found for ${normalizedLoanType} - ${normalizedEmploymentType}`);
                return null;
            }

            logger.info(`Found ${documents.length} required documents for ${normalizedLoanType} - ${normalizedEmploymentType}`);
            return [...documents]; // Return a copy
        } catch (error) {
            logger.error('Error getting required documents:', error);
            return null;
        }
    }

    /**
     * Get description for a specific document
     * @param {string} documentType - Document type
     * @returns {string} Document description
     */
    getDocumentDescription(documentType) {
        return this.documentDescriptions[documentType] || `Upload your ${documentType}`;
    }

    /**
     * Get all document descriptions
     * @returns {Object} Object with document types as keys and descriptions as values
     */
    getAllDocumentDescriptions() {
        return { ...this.documentDescriptions };
    }

    /**
     * Validate loan type
     * @param {string} loanType - Loan type to validate
     * @returns {boolean} True if valid
     */
    isValidLoanType(loanType) {
        const normalized = this.normalizeLoanType(loanType);
        return normalized && Object.keys(this.requirements).includes(normalized);
    }

    /**
     * Validate employment type
     * @param {string} employmentType - Employment type to validate
     * @returns {boolean} True if valid
     */
    isValidEmploymentType(employmentType) {
        const normalized = this.normalizeEmploymentType(employmentType);
        return normalized && ['Salaried', 'Self-employed'].includes(normalized);
    }

    /**
     * Normalize loan type input
     * @param {string} loanType - Raw loan type input
     * @returns {string|null} Normalized loan type or null
     */
    normalizeLoanType(loanType) {
        if (!loanType) return null;
        
        const normalized = loanType.trim();
        const lowerCase = normalized.toLowerCase();
        
        // Direct matches
        const directMatch = Object.keys(this.requirements).find(
            key => key.toLowerCase() === lowerCase
        );
        if (directMatch) return directMatch;
        
        // Partial matches
        if (lowerCase.includes('home') || lowerCase.includes('housing')) return 'Home';
        if (lowerCase.includes('business')) return 'Business';
        if (lowerCase.includes('education') || lowerCase.includes('study')) return 'Education';
        if (lowerCase.includes('personal')) return 'Personal';
        if (lowerCase.includes('vehicle') || lowerCase.includes('car') || lowerCase.includes('bike')) return 'Vehicle';
        
        return null;
    }

    /**
     * Normalize employment type input
     * @param {string} employmentType - Raw employment type input
     * @returns {string|null} Normalized employment type or null
     */
    normalizeEmploymentType(employmentType) {
        if (!employmentType) return null;
        
        const lowerCase = employmentType.trim().toLowerCase();
        
        if (lowerCase.includes('salaried') || lowerCase.includes('employee') || lowerCase.includes('job')) {
            return 'Salaried';
        }
        
        if (lowerCase.includes('self') || lowerCase.includes('business') || lowerCase.includes('freelance')) {
            return 'Self-employed';
        }
        
        return null;
    }

    /**
     * Get statistics about document requirements
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const stats = {
            totalLoanTypes: Object.keys(this.requirements).length,
            totalEmploymentTypes: Object.keys(this.requirements.Home || {}).length,
            documentStats: {}
        };

        // Count documents per loan type
        for (const [loanType, employmentTypes] of Object.entries(this.requirements)) {
            stats.documentStats[loanType] = {};
            for (const [empType, documents] of Object.entries(employmentTypes)) {
                stats.documentStats[loanType][empType] = documents.length;
            }
        }

        return stats;
    }

    /**
     * Add new document requirement (for future expansion)
     * @param {string} loanType - Loan type
     * @param {string} employmentType - Employment type
     * @param {string} documentType - Document type to add
     * @returns {boolean} Success status
     */
    addDocumentRequirement(loanType, employmentType, documentType) {
        try {
            const normalizedLoanType = this.normalizeLoanType(loanType);
            const normalizedEmploymentType = this.normalizeEmploymentType(employmentType);

            if (!normalizedLoanType || !normalizedEmploymentType) {
                return false;
            }

            if (!this.requirements[normalizedLoanType]) {
                this.requirements[normalizedLoanType] = {};
            }

            if (!this.requirements[normalizedLoanType][normalizedEmploymentType]) {
                this.requirements[normalizedLoanType][normalizedEmploymentType] = [];
            }

            const documents = this.requirements[normalizedLoanType][normalizedEmploymentType];
            if (!documents.includes(documentType)) {
                documents.push(documentType);
                logger.info(`Added document requirement: ${documentType} for ${normalizedLoanType}-${normalizedEmploymentType}`);
                return true;
            }

            return false; // Already exists
        } catch (error) {
            logger.error('Error adding document requirement:', error);
            return false;
        }
    }
}

module.exports = DocumentRequirements();
