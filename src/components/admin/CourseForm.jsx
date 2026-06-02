import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService } from '../../services/api';
import axios from 'axios';

const { FiX, FiSave, FiUpload, FiFile, FiVideo, FiBook, FiCheck, FiTrash2, FiLoader, FiAlertCircle, FiDollarSign, FiUsers, FiAlertTriangle, FiKey, FiCopy, FiClock, FiActivity } = FiIcons;

const TAXONOMY = {
  'SAT': {
    'SAT Math': {
      'Algebra': [
        'Linear equations in one variable',
        'Linear functions',
        'Linear equations in two variables',
        'Systems of two linear equations in two variables',
        'Linear inequalities in one or two variables'
      ],
      'Advanced Math': [
        'Nonlinear functions',
        'Nonlinear equations in one variable and systems of equations in two variables',
        'Equivalent expressions'
      ],
      'Problem-Solving and Data Analysis': [
        'Ratios, rates, proportional relationships, and units',
        'Percentages',
        'One-variable data: Distributions and measures of center and spread',
        'Two-variable data: Models and scatterplots',
        'Probability and conditional probability',
        'Inference from sample statistics and margin of error',
        'Evaluating statistical claims: Observational studies and experiments'
      ],
      'Geometry and Trigonometry': [
        'Area and volume',
        'Lines, angles, and triangles',
        'Right triangles and trigonometry',
        'Circles'
      ]
    },
    'SAT Reading & Writing': {
      'Craft and Structure': [
        'Words in Context',
        'Text Structure and Purpose',
        'Cross-Text Connections'
      ],
      'Information and Ideas': [
        'Central Ideas and Details',
        'Command of Evidence',
        'Inferences'
      ],
      'Standard English Conventions': [
        'Boundaries',
        'Form, Structure, and Sense'
      ],
      'Expression of Ideas': [
        'Transitions',
        'Rhetorical Synthesis'
      ]
    }
  },
  'ACT': {
    'ACT Math': {
      'Unit 1 - Tips, Techniques, and Strategies': [
        'Pick Your Own Numbers',
        'Solving Backwards'
      ],
      'Unit 2 - Pre-Algebra': [
        'Integers',
        'Digits',
        'Even & Odd',
        'Positives, Negatives, and Zero',
        'Fractions',
        'Divisibility, Factors & Multiples',
        'Prime Numbers',
        'Combinations',
        'Permutations & Probabilities',
        'Percents'
      ],
      'Unit 3 - Elementary Algebra': [
        'Translation',
        'Roots & Exponents',
        'Solve for the Whole Expression',
        'Ratios & Proportions',
        'Rates',
        'Mean, Median, and Mode'
      ],
      'Unit 4 - Plane Geometry': [
        'Related Angles',
        'Triangles',
        'Circles',
        'Polygons'
      ],
      'Unit 5 - Intermediate Algebra': [
        'F.O.I.L. & Factor',
        'Absolute Value',
        'Inequalities',
        'Matrices',
        'Sequences'
      ],
      'Unit 6 - Functions': [
        'Functions',
        'Linear Equations',
        'Function Tables',
        'Funky Function Symbols',
        'Real Life Functions',
        'Quadratic Functions',
        'Squiggly Functions'
      ],
      'Unit 7 - Coordinate Geometry': [
        'Distances & Midpoints',
        'Shapes on a Coordinate Plane',
        'Circles & Ellipses'
      ],
      'Unit 8 - Trigonometry & Logarithms': [
        'Trigonometry',
        'Logarithms',
        'Complex Numbers'
      ]
    },
    'ACT English': {
      'Unit 1 - Grammar & Punctuation': [
        'Parts of Speech',
        'Adjectives vs. Adverbs',
        'Possessive, Plural, and Contraction'
      ],
      'Unit 2 - Sentence Structure': [
        'Sentences & Fragments',
        'Run-On Sentences',
        'Colons, Dashes, and Semicolons'
      ],
      'Unit 3 - Usage & Mechanics (Part 1)': [
        'Subject Verb Agreement',
        'Verb Tense',
        'Pronoun Errors',
        'Comparative vs. Superlative'
      ],
      'Unit 4 - Rhetorical Skills (Part 1)': [
        'Redundancy & Wordiness',
        'Transitions & Conclusions',
        'Relevance: Adding & Removing Info'
      ],
      'Unit 5 - Usage & Mechanics (Part 2)': [
        'Parallelism',
        'Misplaced Modifier'
      ],
      'Unit 6 - Rhetorical Skills (Part 2)': [
        'Move a Sentence or Paragraph',
        'Writer\'s Goal'
      ]
    },
    'ACT Science': {
      'Unit 1': [
        'Intro to ACT Science',
        'Strategy & Tips for ACT Science',
        'Assigned',
        'Graphs & Tables'
      ],
      'Unit 2': [
        'Data Representation'
      ],
      'Unit 3': [
        'Research Summary'
      ],
      'Unit 4': [
        'Conflicting Viewpoints'
      ]
    },
    'ACT Reading': {
      'Unit 1': [
        'Reading Introduction',
        'Active Reading',
        'General Strategy'
      ],
      'Unit 2': [
        'Local vs. Global',
        'Common Trap Answers'
      ],
      'Unit 3': [
        'Direct & Indirect Questions',
        'Advanced Strategies'
      ],
      'Unit 4': [
        'Paired Reading Passages',
        'Advanced Strategy for Paired Passages'
      ]
    }
  },
  'AP': {
    'AP Biology': {
      'Unit 1: Chemistry of Life': [
        'Structure of Water and Hydrogen Bonding',
        'Elements of Life',
        'Introduction to Biological Macromolecules',
        'Carbohydrates',
        'Lipids',
        'Nucleic Acids',
        'Proteins'
      ],
      'Unit 2: Cells': [
        'Cell Structure',
        'Cell Size',
        'Plasma Membranes',
        'Membrane Transport',
        'Facilitated Diffusion',
        'Tonicity and Osmoregulation',
        'Cell Compartmentalization'
      ],
      'Unit 3: Cellular Energetics': [
        'Enzyme Structure and Catalysis',
        'Environmental Impacts on Enzyme Function',
        'Cellular Energy',
        'Photosynthesis',
        'Cellular Respiration',
        'Fitness'
      ],
      'Unit 4: Cell Communication and Cell Cycle': [
        'Cell Communication',
        'Signal Transduction',
        'Changes in Signal Transduction Pathways',
        'Feedback and Homeostasis',
        'Cell Cycle',
        'Regulation of Cell Cycle'
      ],
      'Unit 5: Heredity': [
        'Meiosis',
        'Meiosis and Genetic Diversity',
        'Mendelian Genetics',
        'Non-Mendelian Genetics',
        'Environmental Effects on Phenotype',
        'Chromosomal Inheritance'
      ],
      'Unit 6: Gene Expression and Regulation': [
        'DNA and RNA Structure',
        'DNA Replication',
        'Transcription and RNA Processing',
        'Translation',
        'Regulation of Gene Expression',
        'Gene Expression and Cell Specialization',
        'Mutations',
        'Biotechnology'
      ],
      'Unit 7: Natural Selection': [
        'Introduction to Natural Selection',
        'Artificial Selection',
        'Population Genetics',
        'Hardy-Weinberg Equilibrium',
        'Evidence of Evolution',
        'Common Ancestry',
        'Continuing Evolution',
        'Speciation',
        'Variations in Populations',
        'Origins of Life on Earth'
      ],
      'Unit 8: Ecology': [
        'Responses to the Environment',
        'Energy Flow Through Ecosystems',
        'Population Ecology',
        'Effect of Density of Populations',
        'Community Ecology',
        'Biodiversity',
        'Disruptions to Ecosystems'
      ]
    },
    'AP Calculus AB': {
      'Unit 1: Limits and Continuity': ['Unit 1: Limits and Continuity'],
      'Unit 2: Differentiation: Definition and Fundamental Properties': ['Unit 2: Differentiation: Definition and Fundamental Properties'],
      'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions': ['Unit 3: Differentiation: Composite, Implicit, and Inverse Functions'],
      'Unit 4: Contextual Applications of Differentiation': ['Unit 4: Contextual Applications of Differentiation'],
      'Unit 5: Analytical Applications of Differentiation': ['Unit 5: Analytical Applications of Differentiation'],
      'Unit 6: Integration and Accumulation of Change': ['Unit 6: Integration and Accumulation of Change'],
      'Unit 7: Differential Equations': ['Unit 7: Differential Equations'],
      'Unit 8: Applications of Integration': ['Unit 8: Applications of Integration']
    },
    'AP Calculus BC': {
      'Unit 1: Limits and Continuity': ['Unit 1: Limits and Continuity'],
      'Unit 2: Differentiation: Definition and Fundamental Properties': ['Unit 2: Differentiation: Definition and Fundamental Properties'],
      'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions': ['Unit 3: Differentiation: Composite, Implicit, and Inverse Functions'],
      'Unit 4: Contextual Applications of Differentiation': ['Unit 4: Contextual Applications of Differentiation'],
      'Unit 5: Analytical Applications of Differentiation': ['Unit 5: Analytical Applications of Differentiation'],
      'Unit 6: Integration and Accumulation of Change': ['Unit 6: Integration and Accumulation of Change'],
      'Unit 7: Differential Equations': ['Unit 7: Differential Equations'],
      'Unit 8: Applications of Integration': ['Unit 8: Applications of Integration'],
      'Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions': ['Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions'],
      'Unit 10: Infinite Sequences and Series': ['Unit 10: Infinite Sequences and Series']
    },
    'AP Chemistry': {
      'Unit 1: Atomic Structure and Properties': ['Unit 1: Atomic Structure and Properties'],
      'Unit 2: Compound Structure and Properties': ['Unit 2: Compound Structure and Properties'],
      'Unit 3: Properties of Substances and Mixtures': ['Unit 3: Properties of Substances and Mixtures'],
      'Unit 4: Chemical Reactions': ['Unit 4: Chemical Reactions'],
      'Unit 5: Kinetics': ['Unit 5: Kinetics'],
      'Unit 6: Thermochemistry': ['Unit 6: Thermochemistry'],
      'Unit 7: Equilibrium': ['Unit 7: Equilibrium'],
      'Unit 8: Acids and Bases': ['Unit 8: Acids and Bases'],
      'Unit 9: Thermodynamics and Electrochemistry': ['Unit 9: Thermodynamics and Electrochemistry']
    },
    'AP English Language and Composition': {
      'Topic 1: Rhetorical Situation & Defensible Claims': ['Topic 1: Rhetorical Situation & Defensible Claims'],
      'Topic 2: Audience Appeals & Thesis Crafting': ['Topic 2: Audience Appeals & Thesis Crafting'],
      'Topic 3: Line of Reasoning & Source Synthesis': ['Topic 3: Line of Reasoning & Source Synthesis'],
      'Topic 4: Introductions, Conclusions & Thesis Refinement': ['Topic 4: Introductions, Conclusions & Thesis Refinement'],
      'Topic 5: Coherence, Flow & Stylistic Precision': ['Topic 5: Coherence, Flow & Stylistic Precision'],
      'Topic 6: Evidence Credibility, Bias & Tone Analysis': ['Topic 6: Evidence Credibility, Bias & Tone Analysis'],
      'Topic 7: Nuance, Qualification & Mechanics for Precision': ['Topic 7: Nuance, Qualification & Mechanics for Precision'],
      'Topic 8: Audience-Centered Style & Figurative Persuasion': ['Topic 8: Audience-Centered Style & Figurative Persuasion'],
      'Topic 9: Concession, Refutation & Synthesis': ['Topic 9: Concession, Refutation & Synthesis']
    },
    'AP Environmental Science': {
      'Topic 1: The Living World: Ecosystems': ['Topic 1: The Living World: Ecosystems'],
      'Topic 2: The Living World: Biodiversity': ['Topic 2: The Living World: Biodiversity'],
      'Topic 3: Populations': ['Topic 3: Populations'],
      'Topic 4: Earth Systems and Resources': ['Topic 4: Earth Systems and Resources'],
      'Topic 5: Land and Water Use': ['Topic 5: Land and Water Use'],
      'Topic 6: Energy Resources and Consumption': ['Topic 6: Energy Resources and Consumption'],
      'Topic 7: Atmospheric Pollution': ['Topic 7: Atmospheric Pollution'],
      'Topic 8: Aquatic and Terrestrial Pollution': ['Topic 8: Aquatic and Terrestrial Pollution'],
      'Topic 9: Global Change': ['Topic 9: Global Change']
    },
    'AP Physics 1: Algebra-Based': {
      'Unit 1: Kinematics': [
        'Scalars and Vectors in One Dimension',
        'Displacement, Velocity, and Acceleration',
        'Representing Motion',
        'Reference Frames and Relative Motion',
        'Vectors and Motion in Two Dimensions'
      ],
      'Unit 2: Force and Translational Dynamics': [
        'Systems and Center of Mass',
        'Forces and Free-Body Diagrams',
        'Newton’s Third Law',
        'Newton’s First Law',
        'Newton’s Second Law',
        'Gravitational Force',
        'Kinetic and Static Friction',
        'Spring Forces',
        'Circular Motion'
      ],
      'Unit 3: Work, Energy, and Power': [
        'Translational Kinetic Energy',
        'Work',
        'Potential Energy',
        'Conservation of Energy',
        'Power'
      ],
      'Unit 4: Linear Momentum': [
        'Linear Momentum',
        'Change in Momentum and Impulse',
        'Conservation of Linear Momentum',
        'Elastic and Inelastic Collisions'
      ],
      'Unit 5: Torque and Rotational Dynamics': [
        'Rotational Kinematics',
        'Connecting Linear and Rotational Motion',
        'Torque',
        'Rotational Inertia',
        'Rotational Equilibrium and Newton’s First Law in Rotational Form',
        'Newton’s Second Law in Rotational Form'
      ],
      'Unit 6: Energy and Momentum of Rotating Systems': [
        'Rotational Kinetic Energy',
        'Torque and Work',
        'Angular Momentum and Angular Impulse',
        'Conservation of Angular Momentum',
        'Rolling',
        'Motion of Orbiting Satellites'
      ],
      'Unit 7: Oscillations': [
        'Defining Simple Harmonic Motion (SHM)',
        'Frequency and Period of SHM',
        'Representing and Analyzing SHM',
        'Energy of Simple Harmonic Oscillators'
      ],
      'Unit 8: Fluids': [
        'Internal Structure and Density',
        'Pressure',
        'Fluids and Newton’s Laws',
        'Fluids and Conservation Laws'
      ]
    },
    'AP Physics C: Mechanics': {
      'Topic 1: Kinematics': ['Topic 1: Kinematics'],
      'Topic 2: Force and Translational Dynamics': ['Topic 2: Force and Translational Dynamics'],
      'Topic 3: Work, Energy, and Power': ['Topic 3: Work, Energy, and Power'],
      'Topic 4: Linear Momentum': ['Topic 4: Linear Momentum'],
      'Topic 5: Torque and Rotational Dynamics': ['Topic 5: Torque and Rotational Dynamics'],
      'Topic 6: Energy and Momentum of Rotating Systems': ['Topic 6: Energy and Momentum of Rotating Systems'],
      'Topic 7: Oscillations': ['Topic 7: Oscillations']
    },
    'AP Psychology': {
      'Unit 1: Biological Bases of Behavior': ['Unit 1: Biological Bases of Behavior'],
      'Unit 2: Cognition': ['Unit 2: Cognition'],
      'Unit 3: Development and Learning': ['Unit 3: Development and Learning'],
      'Unit 4: Social Psychology and Personality': ['Unit 4: Social Psychology and Personality'],
      'Unit 5: Mental and Physical Health': ['Unit 5: Mental and Physical Health']
    },
    'AP United States Government and Politics': {
      'Unit 1: Foundations of American Democracy': ['Unit 1: Foundations of American Democracy'],
      'Unit 2: Interactions Among Branches of Government': ['Unit 2: Interactions Among Branches of Government'],
      'Unit 3: Civil Liberties and Civil Rights': ['Unit 3: Civil Liberties and Civil Rights'],
      'Unit 4: American Political Ideologies and Beliefs': ['Unit 4: American Political Ideologies and Beliefs'],
      'Unit 5: Political Participation': ['Unit 5: Political Participation']
    },
    'AP United States History': {
      'Unit 1: Period 1 (1491-1607)': ['Unit 1: Period 1 (1491-1607)'],
      'Unit 2: Period 2 (1607-1754)': ['Unit 2: Period 2 (1607-1754)'],
      'Unit 3: Period 3 (1754-1800)': ['Unit 3: Period 3 (1754-1800)'],
      'Unit 4: Period 4 (1800-1848)': ['Unit 4: Period 4 (1800-1848)'],
      'Unit 5: Period 5 (1844-1877)': ['Unit 5: Period 5 (1844-1877)'],
      'Unit 6: Period 6 (1865-1898)': ['Unit 6: Period 6 (1865-1898)'],
      'Unit 7: Period 7 (1890-1945)': ['Unit 7: Period 7 (1890-1945)'],
      'Unit 8: Period 8 (1945-1980)': ['Unit 8: Period 8 (1945-1980)'],
      'Unit 9: Period 9 (1980-Present)': ['Unit 9: Period 9 (1980-Present)']
    }
  }
};

const CourseForm = ({ course, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    const mainCat = course?.main_category || 'SAT';
    const subCourses = Object.keys(TAXONOMY[mainCat] || {});
    const subCat = course?.tutor_type || (subCourses.length > 0 ? subCourses[0] : '');
    
    const topics = subCat ? Object.keys(TAXONOMY[mainCat]?.[subCat] || {}) : [];
    const topic = course?.category || (topics.length > 0 ? topics[0] : '');
    
    const subTopics = (mainCat && subCat && topic) ? (TAXONOMY[mainCat]?.[subCat]?.[topic] || []) : [];
    const name = course?.name || (subTopics.length > 0 ? subTopics[0] : '');

    return {
      name,
      tutor_type: subCat,
      description: course?.description || '',
      status: course?.status || 'active',
      price_full: course?.price_full || '',
      manual_enrollment_count: course?.manual_enrollment_count || '',
      price_section_a: course?.price_section_a || '',
      price_section_b: course?.price_section_b || '',
      start_date: course?.start_date ? new Date(course.start_date).toISOString().slice(0, 16) : '',
      is_practice: course?.is_practice || false,
      is_demo: course?.is_demo || false,
      main_category: mainCat,
      category: topic
    };
  });

  const [newFiles, setNewFiles] = useState({});
  const [existingFiles, setExistingFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingUploads, setFetchingUploads] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ message: '', type: 'info' });
  
  // Enrollment Key State
  const [generateKey, setGenerateKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyOptions, setKeyOptions] = useState({
    maxUses: '',
    maxStudents: '',
    validUntil: '',
    description: ''
  });

  useEffect(() => {
    if (course?.id) {
      loadExistingUploads();
    }
  }, [course]);

  // Auto-enable key generation for new practice courses
  useEffect(() => {
    if (formData.is_practice && !course?.id && !generateKey) {
      setGenerateKey(true);
    }
  }, [formData.is_practice]);

  const loadExistingUploads = async () => {
    setFetchingUploads(true);
    try {
      const { data } = await uploadService.getAll({ courseId: course.id });
      const mapped = {};
      data.forEach(file => {
        const levelKey = file.level === 'All' ? 'main' : file.level.toLowerCase();
        let typeKey = '';
        if (file.category === 'study_material') typeKey = 'study';
        else if (file.category === 'video_lecture') typeKey = 'video';
        else if (file.category === 'quiz_document') typeKey = 'quiz';
        if (levelKey && typeKey) mapped[`${levelKey}_${typeKey}`] = file;
      });
      setExistingFiles(mapped);
    } catch (err) {
      console.error("Failed to load uploads:", err);
    } finally {
      setFetchingUploads(false);
    }
  };

  const handleDeleteExisting = async (key, fileId) => {
    try {
      setUploadStatus({ message: 'Deleting file...', type: 'info' });
      await uploadService.delete(fileId);
      setExistingFiles(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setUploadStatus({ message: 'File deleted', type: 'success' });
    } catch (err) {
      setUploadStatus({ message: 'Delete failed', type: 'error' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'main_category') {
      const subCourses = Object.keys(TAXONOMY[value] || {});
      const defaultSubCourse = subCourses.length > 0 ? subCourses[0] : 'General';
      const topics = Object.keys(TAXONOMY[value]?.[defaultSubCourse] || {});
      const defaultTopic = topics.length > 0 ? topics[0] : '';
      const subTopics = TAXONOMY[value]?.[defaultSubCourse]?.[defaultTopic] || [];
      const defaultSubTopic = subTopics.length > 0 ? subTopics[0] : '';
      
      setFormData({
        ...formData,
        main_category: value,
        tutor_type: defaultSubCourse,
        category: defaultTopic,
        name: defaultSubTopic // Auto-populate name with default sub-topic
      });
    } else if (name === 'tutor_type') {
      const topics = Object.keys(TAXONOMY[formData.main_category]?.[value] || {});
      const defaultTopic = topics.length > 0 ? topics[0] : '';
      const subTopics = TAXONOMY[formData.main_category]?.[value]?.[defaultTopic] || [];
      const defaultSubTopic = subTopics.length > 0 ? subTopics[0] : '';

      setFormData({
        ...formData,
        tutor_type: value,
        category: defaultTopic,
        name: defaultSubTopic // Auto-populate name with default sub-topic
      });
    } else if (name === 'category') {
      const subTopics = TAXONOMY[formData.main_category]?.[formData.tutor_type]?.[value] || [];
      const defaultSubTopic = subTopics.length > 0 ? subTopics[0] : '';

      setFormData({
        ...formData,
        category: value,
        name: defaultSubTopic // Auto-populate name with default sub-topic
      });
    } else if (name === 'subtopic') {
      setFormData({
        ...formData,
        name: value
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (key, file) => setNewFiles(prev => ({ ...prev, [key]: file }));

  // State for custom key
  const [customKey, setCustomKey] = useState('');

  const createEnrollmentKey = async (courseId) => {
    try {
      if (customKey && (customKey.length < 4 || customKey.length > 12)) {
        setError('Enrollment Key must be between 4 and 12 characters.');
        setLoading(false);
        return null;
      }

      const payload = {
        courseId,
        customCode: customKey || undefined, // Send custom code if provided
        maxUses: keyOptions.maxUses ? parseInt(keyOptions.maxUses) : null,
        maxStudents: keyOptions.maxStudents ? parseInt(keyOptions.maxStudents) : null,
        validUntil: keyOptions.validUntil || null,
        description: keyOptions.description || `Access key for ${formData.name}`
      };

      const response = await axios.post('/api/enrollment/create-key', payload);

      if (response.data.success || response.data.key) {
        setGeneratedKey(response.data.key); // Store the full key object
        setUploadStatus({ message: 'Course and Key created successfully!', type: 'success' });
        return response.data.key;
      }
    } catch (error) {
      console.error('Error generating key:', error);
      setError('Failed to generate enrollment key: ' + (error.response?.data?.error || error.message));
    }
    return null;
  };

  const copyKeyToClipboard = () => {
    if (generatedKey?.key_code) {
      navigator.clipboard.writeText(generatedKey.key_code);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUploadStatus({ message: 'Saving course...', type: 'info' });

    try {
      // 1. Save Course
      // Only include fields that actually exist in the courses table
      const cleanData = {
        name: formData.name,
        description: formData.description,
        tutor_type: formData.tutor_type,
        price: Number(formData.price_full) || 0,
        currency: 'INR',
        is_free: Number(formData.price_full) === 0,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        is_practice: formData.is_practice,
        is_demo: formData.is_demo,
        status: formData.status || 'active',
        manual_enrollment_count: Number(formData.manual_enrollment_count) || 0,
        main_category: formData.main_category,
        category: formData.category
      };

      let savedCourse;
      if (course?.id) {
        console.log('📝 Updating existing course:', course.id);
        const response = await courseService.update(course.id, cleanData);
        console.log('📡 Update response:', response);
        
        if (response.error) {
          throw new Error(`Update error: ${response.error.message || response.error}`);
        }
        
        savedCourse = response.data;
        // Fallback for different response structures
        if (!savedCourse && !response.error) savedCourse = response;
        if (Array.isArray(savedCourse)) savedCourse = savedCourse[0];
      } else {
        console.log('➕ Creating new course with data:', cleanData);
        const response = await courseService.create(cleanData);
        console.log('📡 Create response:', response);

        if (response.error) {
          throw new Error(`Database error: ${response.error.message || response.error}`);
        }

        savedCourse = response.data;
        // Fallback for different response structures
        if (!savedCourse && !response.error) savedCourse = response;
        if (Array.isArray(savedCourse)) savedCourse = savedCourse[0];
      }

      console.log('🔍 Saved course object:', savedCourse);

      // Verify course was saved
      if (!savedCourse || !savedCourse.id) {
        console.error('❌ No course ID found! savedCourse:', savedCourse);
        throw new Error('Failed to save course - no course ID returned. Check browser console for details.');
      }

      console.log('✅ Course saved:', savedCourse);

      // 2. Generate Enrollment Key if requested
      if (generateKey && savedCourse?.id) {
        setUploadStatus({ message: 'Generating enrollment key...', type: 'info' });
        await createEnrollmentKey(savedCourse.id);
      }

      // 3. Upload Files with Auto-Cleanup
      const uploadKeys = Object.keys(newFiles);
      const errors = [];
      let successCount = 0;

      for (const key of uploadKeys) {
        const file = newFiles[key];
        if (!file) continue;

        // AUTO-CLEANUP: If replacing an existing file in this slot, delete the old one first
        if (existingFiles[key]) {
          setUploadStatus({ message: `Replacing old ${key.replace('_', ' ')}...`, type: 'info' });
          try {
            await uploadService.delete(existingFiles[key].id);
          } catch (delErr) {
            console.warn(`Failed to delete old file for ${key}`, delErr);
          }
        }

        setUploadStatus({ message: `Uploading ${file.name}...`, type: 'info' });

        // Determine metadata
        let category = 'source_document';
        let level = 'All';
        let parse = 'false';

        const lastUnderscoreIndex = key.lastIndexOf('_');
        if (lastUnderscoreIndex !== -1) {
          const lvlStr = key.substring(0, lastUnderscoreIndex); // e.g. "unit 1: chemistry of life" or "easy"
          const typeStr = key.substring(lastUnderscoreIndex + 1); // e.g. "study", "video", "quiz"
          
          if (['AP', 'ACT'].includes(formData.main_category)) {
            const units = Object.keys(TAXONOMY[formData.main_category]?.[formData.tutor_type] || {});
            const matchedUnit = units.find(u => u.toLowerCase() === lvlStr.toLowerCase());
            level = matchedUnit || lvlStr;
          } else {
            level = lvlStr === 'ap' ? 'AP' : lvlStr.charAt(0).toUpperCase() + lvlStr.slice(1);
          }

          if (typeStr === 'study') category = 'study_material';
          else if (typeStr === 'video') category = 'video_lecture';
          else if (typeStr === 'quiz') {
            category = 'quiz_document';
            parse = 'true';
          }
        }

        try {
          const res = await courseService.uploadFile(savedCourse.id, file, { category, level, parse });
          if (res.data?.warning) {
            errors.push(`${file.name}: ${res.data.message}`);
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Upload error for ${key}:`, err);

          // Enhanced error message
          let errorMsg = err.message || 'Upload failed';

          if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
            errorMsg = '❌ Backend server is not responding. Please ensure the backend is running on port 3001.';
          } else if (err.code === 'ECONNREFUSED') {
            errorMsg = '❌ Cannot connect to backend server. Run: npm run server';
          } else if (err.response?.status === 404) {
            errorMsg = '❌ Upload endpoint not found. Backend may have issues.';
          } else if (err.response?.status === 413) {
            errorMsg = '❌ File too large. Maximum size is 2GB.';
          } else if (err.response?.data?.error) {
            errorMsg = err.response.data.error;
          }

          errors.push(`${file.name}: ${errorMsg}`);
        }
      }

      if (errors.length > 0) {
        setError(errors.join('; '));
        setUploadStatus({ message: 'Saved with errors', type: 'error' });
      } else {
        setUploadStatus({ message: generateKey ? 'Course saved! Enrollment key generated!' : 'All saved successfully!', type: 'success' });
        if (!generateKey) {
          setTimeout(() => {
            onSave();
            onClose();
          }, 1500);
        }
        // If key was generated, keep modal open to show the key
      }
    } catch (error) {
      console.error('Save error:', error);

      let errorMsg = error.message || 'Failed to save course.';

      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMsg = '❌ Backend server is not running. Please start it with: npm run server';
      }

      setError(errorMsg);
      setUploadStatus({ message: 'Error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] border dark:border-slate-800"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{course ? 'Edit Course' : 'Create Course'}</h3>
            <p className="text-sm text-gray-500">Manage content and files</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <SafeIcon icon={FiX} className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-slate-950">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 border-2 border-red-300 text-red-800 px-5 py-4 rounded-lg flex items-start gap-3 shadow-sm">
                <SafeIcon icon={FiAlertTriangle} className="w-6 h-6 mt-0.5 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="font-bold text-sm mb-1">Upload Error</p>
                  <p className="text-sm leading-relaxed">{error}</p>
                  {error.includes('Backend server is not running') && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
                      <p className="font-bold mb-1">🔧 Quick Fix:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Open a terminal</li>
                        <li>Run: <code className="bg-yellow-100 px-1 py-0.5 rounded font-mono">npm run server</code></li>
                        <li>Wait for "Server running" message</li>
                        <li>Try uploading again</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4-Level Hierarchy Selection - EXACT MATCH TO DESIGN */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {['AP', 'ACT'].includes(formData.main_category) ? (
                  <>
                    {/* Level 1: Main Course */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">1. Main Course</label>
                      <select
                        name="main_category"
                        value={formData.main_category}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {Object.keys(TAXONOMY).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Level 2: Subject */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">2. Subject</label>
                      <select
                        name="tutor_type"
                        value={formData.tutor_type}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {Object.keys(TAXONOMY[formData.main_category] || {}).map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    {/* Level 3: Unit / Topic */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">3. Unit / Topic</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {!formData.category && <option value="">Select Unit / Topic</option>}
                        {Object.keys(TAXONOMY[formData.main_category]?.[formData.tutor_type] || {}).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Level 1: Main Course */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">1. Main Course</label>
                      <select
                        name="main_category"
                        value={formData.main_category}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {Object.keys(TAXONOMY).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Level 2: Sub Course */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">2. Sub Course</label>
                      <select
                        name="tutor_type"
                        value={formData.tutor_type}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {Object.keys(TAXONOMY[formData.main_category] || {}).map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    {/* Level 3: Topic */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">3. Topic</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {!formData.category && <option value="">Select Topic</option>}
                        {Object.keys(TAXONOMY[formData.main_category]?.[formData.tutor_type] || {}).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Level 4: Sub Topic */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">4. Sub Topic</label>
                      <select
                        name="subtopic"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white font-semibold transition-all"
                      >
                        {!formData.name && <option value="">Select Sub Topic</option>}
                        {(TAXONOMY[formData.main_category]?.[formData.tutor_type]?.[formData.category] || []).map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Final Course Name (Sub Topic Display - EDITABLE) */}
                <div className="md:col-span-2 pt-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Final Course Name (displayed to students)</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Enter course title"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 bg-gray-50/30 font-medium transition-all"
                  />
                  <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5 italic">
                    <SafeIcon icon={FiIcons.FiZap} className="w-3.5 h-3.5 text-amber-500" />
                    {['AP', 'ACT'].includes(formData.main_category)
                      ? "This name is auto-populated by the selected Unit / Topic. You can edit it if needed."
                      : "This name is auto-populated by the selected Sub Topic. You can edit it if needed."}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Enter course description (optional)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white transition-all"
                  />
                </div>
              </div>
            </div>


            {/* Display Settings (Price & Enrollment) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <h4 className="font-bold text-gray-900 text-lg border-b pb-2 mb-4">Marketing & Display</h4>
              
              <div className="md:col-span-2 pb-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Publishing Type</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className={`flex-1 border p-4 rounded-xl cursor-pointer transition-all ${!formData.is_practice ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="is_practice_type"
                          checked={!formData.is_practice}
                          onChange={() => setFormData({ ...formData, is_practice: false })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-gray-900">Publish as Course Only</p>
                          <p className="text-xs text-gray-500 mt-0.5">Appears only in My Courses</p>
                        </div>
                      </div>
                    </label>
                    <label className={`flex-1 border p-4 rounded-xl cursor-pointer transition-all ${formData.is_practice ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="is_practice_type"
                          checked={formData.is_practice}
                          onChange={() => setFormData({ ...formData, is_practice: true })}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-gray-900">Publish as Practice Test</p>
                          <p className="text-xs text-gray-500 mt-0.5">Appears in Practice Tests</p>
                        </div>
                      </div>
                    </label>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <SafeIcon icon={FiUsers} className="w-4 h-4 text-gray-500" />
                    Students Enrolled (Display Count)
                  </label>
                  <input
                    type="number"
                    name="manual_enrollment_count"
                    value={formData.manual_enrollment_count}
                    onChange={handleChange}
                    placeholder="e.g. 1248"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty or 0 to show real enrollment count.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <SafeIcon icon={FiDollarSign} className="w-4 h-4 text-gray-500" />
                    Price (INR)
                  </label>
                  <input
                    type="number"
                    name="price_full"
                    value={formData.price_full}
                    onChange={handleChange}
                    placeholder="e.g. 1999"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                  />
                  </div>
                </div>

                <div className="flex items-start gap-4 col-span-2 mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                  <input
                    type="checkbox"
                    id="is_demo"
                    name="is_demo"
                    checked={formData.is_demo}
                    onChange={(e) => setFormData({ ...formData, is_demo: e.target.checked })}
                    className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="is_demo" className="text-sm font-extrabold text-[#1E88E5] cursor-pointer flex items-center gap-2">
                      <SafeIcon icon={FiActivity} className="w-5 h-5" />
                      Mark as Public Demo Course
                    </label>
                    <p className="text-xs text-blue-700 mt-1 font-medium italic">
                      Enable this to generate a standalone public link that requires no login/signup.
                    </p>
                </div>
              </div>
            </div>

            {/* Enrollment Key Generator */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <h4 className="font-bold text-gray-900 text-lg border-b pb-2 mb-4 flex items-center gap-2">
                <SafeIcon icon={FiKey} className="w-5 h-5 text-blue-600" />
                Enrollment Key (Optional)
              </h4>

              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  id="generateKey"
                  checked={generateKey}
                  onChange={(e) => setGenerateKey(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <label htmlFor="generateKey" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Generate enrollment key when creating this course
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Students will need this key to enroll in the course
                  </p>
                </div>
              </div>

              {generateKey && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-4 border-t border-gray-100"
                >
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                      <span>Custom Key Code (Optional)</span>
                      <span className={`text-[10px] ${customKey.length > 0 && (customKey.length < 4 || customKey.length > 12) ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        {customKey.length}/12 chars (Min 4)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={customKey}
                      maxLength={12}
                      onChange={(e) => setCustomKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      placeholder="e.g. SUMMER-2024 (Leave empty for random)"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50/50 uppercase tracking-wider font-mono text-blue-900 ${customKey.length > 0 && (customKey.length < 4 || customKey.length > 12)
                        ? 'border-red-300 ring-red-500'
                        : 'border-blue-200'
                        }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">If empty, a code like MATH-X7Y2 will be generated.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Uses (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={keyOptions.maxUses}
                        onChange={(e) => setKeyOptions({ ...keyOptions, maxUses: e.target.value })}
                        placeholder="Unlimited (Leave empty)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">How many times the key can be used. Leave empty for infinite.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Students (Optional)
                      </label>
                      <input
                        type="number"
                        value={keyOptions.maxStudents}
                        onChange={(e) => setKeyOptions({ ...keyOptions, maxStudents: e.target.value })}
                        placeholder="Unlimited (Leave empty)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum number of students who can use this key</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiClock} className="w-4 h-4" />
                        Valid Until (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={keyOptions.validUntil}
                        onChange={(e) => setKeyOptions({ ...keyOptions, validUntil: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to never expire</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={keyOptions.description}
                        onChange={(e) => setKeyOptions({ ...keyOptions, description: e.target.value })}
                        placeholder="Batch 2026"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {generatedKey && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border border-green-200 rounded-lg p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <SafeIcon icon={FiCheck} className="w-6 h-6 text-green-600" />
                    <h5 className="font-bold text-green-900">Enrollment Key Generated!</h5>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <code className="flex-1 text-lg font-mono font-bold bg-white px-4 py-3 rounded-lg text-blue-600 border border-green-300">
                      {generatedKey.key_code}
                    </code>
                    <button
                      type="button"
                      onClick={copyKeyToClipboard}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <SafeIcon icon={copiedKey ? FiCheck : FiCopy} className="w-5 h-5" />
                      {copiedKey ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="text-sm text-green-800 space-y-1">
                    <p>✓ Share this key with your students</p>
                    <p>✓ Students can use it to enroll in the course</p>
                    {generatedKey.max_uses && <p>✓ Valid for {generatedKey.max_uses} uses</p>}
                    {generatedKey.valid_until && <p>✓ Expires on {new Date(generatedKey.valid_until).toLocaleDateString()}</p>}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Upload Sections */}
            <div className="space-y-6">
              <h4 className="font-bold text-gray-900 dark:text-white text-xl">Course Materials</h4>
              {fetchingUploads ? (
                <div className="text-gray-500">Loading files...</div>
              ) : ['AP', 'ACT'].includes(formData.main_category) ? (
                <SequentialUploadSection
                  mainCategory={formData.main_category}
                  tutorType={formData.tutor_type}
                  newFiles={newFiles}
                  existingFiles={existingFiles}
                  onFileChange={handleFileChange}
                  onDeleteExisting={handleDeleteExisting}
                />
              ) : (
                <>
                  <LevelUploadSection
                    level="Easy"
                    color="green"
                    icon={FiBook}
                    newFiles={newFiles}
                    existingFiles={existingFiles}
                    onFileChange={handleFileChange}
                    onDeleteExisting={handleDeleteExisting}
                  />
                  <LevelUploadSection
                    level="Medium"
                    color="yellow"
                    icon={FiBook}
                    newFiles={newFiles}
                    existingFiles={existingFiles}
                    onFileChange={handleFileChange}
                    onDeleteExisting={handleDeleteExisting}
                  />
                  <LevelUploadSection
                    level="Hard"
                    color="red"
                    icon={FiBook}
                    newFiles={newFiles}
                    existingFiles={existingFiles}
                    onFileChange={handleFileChange}
                    onDeleteExisting={handleDeleteExisting}
                  />
                </>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center">
          <div className={`flex items-center gap-2 text-sm font-medium ${uploadStatus.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
            {loading && <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />}
            {uploadStatus.message}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SafeIcon icon={FiSave} className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Sub-components
const LevelUploadSection = ({ level, color, icon, newFiles, existingFiles, onFileChange, onDeleteExisting }) => {
  const levelKey = level.toLowerCase();
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <h3 className="font-bold mb-4 flex items-center justify-between">
        {level} Level Content
        <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
          {[
            existingFiles[`${levelKey}_study`],
            existingFiles[`${levelKey}_video`],
            existingFiles[`${levelKey}_quiz`]
          ].filter(Boolean).length} files
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FileUploadBox
          id={`${levelKey}_study`}
          label="Study Guide (PDF)"
          icon={FiFile}
          accept=".pdf,.doc,.docx"
          newFile={newFiles[`${levelKey}_study`]}
          existingFile={existingFiles[`${levelKey}_study`]}
          onChange={f => onFileChange(`${levelKey}_study`, f)}
          onDelete={id => onDeleteExisting(`${levelKey}_study`, id)}
        />
        <FileUploadBox
          id={`${levelKey}_video`}
          label="Video (MP4)"
          icon={FiVideo}
          accept=".mp4,.webm"
          newFile={newFiles[`${levelKey}_video`]}
          existingFile={existingFiles[`${levelKey}_video`]}
          onChange={f => onFileChange(`${levelKey}_video`, f)}
          onDelete={id => onDeleteExisting(`${levelKey}_video`, id)}
        />
        <FileUploadBox
          id={`${levelKey}_quiz`}
          label="Quiz File (Parsed)"
          icon={FiBook}
          accept=".txt,.docx"
          highlight
          newFile={newFiles[`${levelKey}_quiz`]}
          existingFile={existingFiles[`${levelKey}_quiz`]}
          onChange={f => onFileChange(`${levelKey}_quiz`, f)}
          onDelete={id => onDeleteExisting(`${levelKey}_quiz`, id)}
        />
      </div>
    </div>
  );
};

const SequentialUploadSection = ({ mainCategory, tutorType, newFiles, existingFiles, onFileChange, onDeleteExisting }) => {
  const unitsMap = TAXONOMY[mainCategory]?.[tutorType] || {};
  const units = Object.keys(unitsMap);

  if (!tutorType || units.length === 0) {
    return (
      <div className="rounded-xl border p-6 bg-amber-50 border-amber-200 text-amber-900 text-center font-medium">
        Please select a Subject (e.g. {mainCategory === 'AP' ? 'AP Biology' : 'ACT Math'}) above to view and upload unit-by-unit materials.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
        <div>
          <h4 className="font-bold text-indigo-950 text-lg">{tutorType} Content Management</h4>
          <p className="text-xs text-indigo-700 mt-1">Upload Study Guides, Videos, and Quizzes for each unit or subtopic individually.</p>
        </div>
        <span className="text-xs bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-full shadow-sm">
          {units.length} Units Total
        </span>
      </div>

      <div className="space-y-6">
        {units.map((unitName, index) => {
          const subtopics = unitsMap[unitName] || [];
          const isSubtopicLevel = !(subtopics.length === 1 && subtopics[0] === unitName);

          return (
            <div 
              key={unitName} 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                    {index + 1}
                  </span>
                  <h5 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    {unitName}
                  </h5>
                </div>
              </div>

              {isSubtopicLevel ? (
                <div className="space-y-6 pl-4 border-l-2 border-indigo-100 ml-4">
                  {subtopics.map((subtopic, subIndex) => {
                    const subKey = subtopic.toLowerCase();
                    const subStudyKey = `${subKey}_study`;
                    const subVideoKey = `${subKey}_video`;
                    const subQuizKey = `${subKey}_quiz`;

                    const uploadedCount = [
                      existingFiles[subStudyKey] || newFiles[subStudyKey],
                      existingFiles[subVideoKey] || newFiles[subVideoKey],
                      existingFiles[subQuizKey] || newFiles[subQuizKey]
                    ].filter(Boolean).length;

                    return (
                      <div key={subtopic} className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h6 className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                            {index + 1}.{subIndex + 1} {subtopic}
                          </h6>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                            uploadedCount === 3 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : uploadedCount > 0 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-slate-200 text-slate-600'
                          }`}>
                            {uploadedCount} / 3 uploaded
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FileUploadBox
                            id={subStudyKey}
                            label={`${mainCategory} Study Guide PDF`}
                            icon={FiFile}
                            accept=".pdf"
                            newFile={newFiles[subStudyKey]}
                            existingFile={existingFiles[subStudyKey]}
                            onChange={f => onFileChange(subStudyKey, f)}
                            onDelete={id => onDeleteExisting(subStudyKey, id)}
                          />
                          <FileUploadBox
                            id={subVideoKey}
                            label={`${mainCategory} Video MP4`}
                            icon={FiVideo}
                            accept=".mp4,.webm"
                            newFile={newFiles[subVideoKey]}
                            existingFile={existingFiles[subVideoKey]}
                            onChange={f => onFileChange(subVideoKey, f)}
                            onDelete={id => onDeleteExisting(subVideoKey, id)}
                          />
                          <FileUploadBox
                            id={subQuizKey}
                            label={`${mainCategory} Quiz File`}
                            icon={FiBook}
                            accept=".txt,.docx"
                            highlight
                            newFile={newFiles[subQuizKey]}
                            existingFile={existingFiles[subQuizKey]}
                            onChange={f => onFileChange(subQuizKey, f)}
                            onDelete={id => onDeleteExisting(subQuizKey, id)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    const unitKey = unitName.toLowerCase();
                    const unitStudyKey = `${unitKey}_study`;
                    const unitVideoKey = `${unitKey}_video`;
                    const unitQuizKey = `${unitKey}_quiz`;

                    return (
                      <>
                        <FileUploadBox
                          id={unitStudyKey}
                          label={`${mainCategory} Study Guide PDF`}
                          icon={FiFile}
                          accept=".pdf"
                          newFile={newFiles[unitStudyKey]}
                          existingFile={existingFiles[unitStudyKey]}
                          onChange={f => onFileChange(unitStudyKey, f)}
                          onDelete={id => onDeleteExisting(unitStudyKey, id)}
                        />
                        <FileUploadBox
                          id={unitVideoKey}
                          label={`${mainCategory} Video MP4`}
                          icon={FiVideo}
                          accept=".mp4,.webm"
                          newFile={newFiles[unitVideoKey]}
                          existingFile={existingFiles[unitVideoKey]}
                          onChange={f => onFileChange(unitVideoKey, f)}
                          onDelete={id => onDeleteExisting(unitVideoKey, id)}
                        />
                        <FileUploadBox
                          id={unitQuizKey}
                          label={`${mainCategory} Quiz File`}
                          icon={FiBook}
                          accept=".txt,.docx"
                          highlight
                          newFile={newFiles[unitQuizKey]}
                          existingFile={existingFiles[unitQuizKey]}
                          onChange={f => onFileChange(unitQuizKey, f)}
                          onDelete={id => onDeleteExisting(unitQuizKey, id)}
                        />
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


const FileUploadBox = ({ label, icon, accept, highlight, newFile, existingFile, onChange, onDelete }) => {
  const fileInputRef = useRef(null);

  return (
    <div className={`rounded-lg p-4 border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        <SafeIcon icon={icon} className={`w-4 h-4 ${highlight ? 'text-blue-700' : 'text-slate-700'}`} />
        <span className="text-sm font-semibold text-slate-800">{label}</span>
      </div>

      {existingFile && !newFile && (
        <div className="mb-2 p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700 flex justify-between items-center">
          <span className="text-xs truncate max-w-[150px] text-slate-950 dark:text-white font-bold" title={existingFile.file_name}>
            {existingFile.file_name}
          </span>
          <button type="button" onClick={() => onDelete(existingFile.id)} className="text-red-500">
            <SafeIcon icon={FiTrash2} className="w-3 h-3" />
          </button>
        </div>
      )}

      {newFile && (
        <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 flex justify-between items-center">
          <span className="text-xs text-slate-950 dark:text-blue-100 font-bold truncate max-w-[150px]" title={newFile.name}>
            {newFile.name}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              fileInputRef.current.value = '';
            }}
            className="text-blue-600"
          >
            <SafeIcon icon={FiX} className="w-3 h-3" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current.click()}
        className="w-full py-2 bg-white border rounded text-xs font-medium hover:bg-gray-50 text-gray-700"
      >
        {existingFile && !newFile ? 'Replace' : (newFile ? 'Change' : 'Upload')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={e => onChange(e.target.files[0])}
      />
    </div>
  );
};

export default CourseForm;
