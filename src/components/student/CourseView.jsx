import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService, progressService, enrollmentService, planService, gradingService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCategory, calculateSatScore } from '../../utils/scoreCalculator';

const { FiArrowLeft, FiLock, FiPlay, FiCheckCircle, FiShield, FiAward, FiTrendingUp, FiInfo, FiKey, FiAlertCircle, FiLoader, FiTarget } = FiIcons;

const SEQUENTIAL_TAXONOMY = {
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
  'AP Calculus AB': [
    'Unit 1: Limits and Continuity',
    'Unit 2: Differentiation: Definition and Fundamental Properties',
    'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions',
    'Unit 4: Contextual Applications of Differentiation',
    'Unit 5: Analytical Applications of Differentiation',
    'Unit 6: Integration and Accumulation of Change',
    'Unit 7: Differential Equations',
    'Unit 8: Applications of Integration'
  ],
  'AP Calculus BC': [
    'Unit 1: Limits and Continuity',
    'Unit 2: Differentiation: Definition and Fundamental Properties',
    'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions',
    'Unit 4: Contextual Applications of Differentiation',
    'Unit 5: Analytical Applications of Differentiation',
    'Unit 6: Integration and Accumulation of Change',
    'Unit 7: Differential Equations',
    'Unit 8: Applications of Integration',
    'Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions',
    'Unit 10: Infinite Sequences and Series'
  ],
  'AP Chemistry': [
    'Unit 1: Atomic Structure and Properties',
    'Unit 2: Compound Structure and Properties',
    'Unit 3: Properties of Substances and Mixtures',
    'Unit 4: Chemical Reactions',
    'Unit 5: Kinetics',
    'Unit 6: Thermochemistry',
    'Unit 7: Equilibrium',
    'Unit 8: Acids and Bases',
    'Unit 9: Thermodynamics and Electrochemistry'
  ],
  'AP English Language and Composition': [
    'Topic 1: Rhetorical Situation & Defensible Claims',
    'Topic 2: Audience Appeals & Thesis Crafting',
    'Topic 3: Line of Reasoning & Source Synthesis',
    'Topic 4: Introductions, Conclusions & Thesis Refinement',
    'Topic 5: Coherence, Flow & Stylistic Precision',
    'Topic 6: Evidence Credibility, Bias & Tone Analysis',
    'Topic 7: Nuance, Qualification & Mechanics for Precision',
    'Topic 8: Audience-Centered Style & Figurative Persuasion',
    'Topic 9: Concession, Refutation & Synthesis'
  ],
  'AP Environmental Science': [
    'Topic 1: The Living World: Ecosystems',
    'Topic 2: The Living World: Biodiversity',
    'Topic 3: Populations',
    'Topic 4: Earth Systems and Resources',
    'Topic 5: Land and Water Use',
    'Topic 6: Energy Resources and Consumption',
    'Topic 7: Atmospheric Pollution',
    'Topic 8: Aquatic and Terrestrial Pollution',
    'Topic 9: Global Change'
  ],
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
  'AP Physics C: Mechanics': [
    'Topic 1: Kinematics',
    'Topic 2: Force and Translational Dynamics',
    'Topic 3: Work, Energy, and Power',
    'Topic 4: Linear Momentum',
    'Topic 5: Torque and Rotational Dynamics',
    'Topic 6: Energy and Momentum of Rotating Systems',
    'Topic 7: Oscillations'
  ],
  'AP Psychology': [
    'Unit 1: Biological Bases of Behavior',
    'Unit 2: Cognition',
    'Unit 3: Development and Learning',
    'Unit 4: Social Psychology and Personality',
    'Unit 5: Mental and Physical Health'
  ],
  'AP United States Government and Politics': [
    'Unit 1: Foundations of American Democracy',
    'Unit 2: Interactions Among Branches of Government',
    'Unit 3: Civil Liberties and Civil Rights',
    'Unit 4: American Political Ideologies and Beliefs',
    'Unit 5: Political Participation'
  ],
  'AP United States History': [
    'Unit 1: Period 1 (1491-1607)',
    'Unit 2: Period 2 (1607-1754)',
    'Unit 3: Period 3 (1754-1800)',
    'Unit 4: Period 4 (1800-1848)',
    'Unit 5: Period 5 (1844-1877)',
    'Unit 6: Period 6 (1865-1898)',
    'Unit 7: Period 7 (1890-1945)',
    'Unit 8: Period 8 (1945-1980)',
    'Unit 9: Period 9 (1980-Present)'
  ],
  'ACT Math': {
    'Unit 1 - Tips, Techniques, and Strategies': ['Pick Your Own Numbers', 'Solving Backwards'],
    'Unit 2 - Pre-Algebra': ['Integers', 'Digits', 'Even & Odd', 'Positives, Negatives, and Zero', 'Fractions', 'Divisibility, Factors & Multiples', 'Prime Numbers', 'Combinations', 'Permutations & Probabilities', 'Percents'],
    'Unit 3 - Elementary Algebra': ['Translation', 'Roots & Exponents', 'Solve for the Whole Expression', 'Ratios & Proportions', 'Rates', 'Mean, Median, and Mode'],
    'Unit 4 - Plane Geometry': ['Related Angles', 'Triangles', 'Circles', 'Polygons'],
    'Unit 5 - Intermediate Algebra': ['F.O.I.L. & Factor', 'Absolute Value', 'Inequalities', 'Matrices', 'Sequences'],
    'Unit 6 - Functions': ['Functions', 'Linear Equations', 'Function Tables', 'Funky Function Symbols', 'Real Life Functions', 'Quadratic Functions', 'Squiggly Functions'],
    'Unit 7 - Coordinate Geometry': ['Distances & Midpoints', 'Shapes on a Coordinate Plane', 'Circles & Ellipses'],
    'Unit 8 - Trigonometry & Logarithms': ['Trigonometry', 'Logarithms', 'Complex Numbers']
  },
  'ACT English': {
    'Unit 1 - Grammar & Punctuation': ['Parts of Speech', 'Adjectives vs. Adverbs', 'Possessive, Plural, and Contraction'],
    'Unit 2 - Sentence Structure': ['Sentences & Fragments', 'Run-On Sentences', 'Colons, Dashes, and Semicolons'],
    'Unit 3 - Usage & Mechanics (Part 1)': ['Subject Verb Agreement', 'Verb Tense', 'Pronoun Errors', 'Comparative vs. Superlative'],
    'Unit 4 - Rhetorical Skills (Part 1)': ['Redundancy & Wordiness', 'Transitions & Conclusions', 'Relevance: Adding & Removing Info'],
    'Unit 5 - Usage & Mechanics (Part 2)': ['Parallelism', 'Misplaced Modifier'],
    'Unit 6 - Rhetorical Skills (Part 2)': ['Move a Sentence or Paragraph', 'Writer\'s Goal']
  },
  'ACT Science': {
    'Unit 1: Data Representation': ['Data Representation'],
    'Unit 2: Research Summary': ['Research Summary'],
    'Unit 3: Conflicting Viewpoints': ['Conflicting Viewpoints']
  },
  'ACT Reading': [
    'Vocabulary-in-Context Questions',
    'Inference Questions',
    'Paraphrase Questions',
    'Point-of-View Questions',
    "Author's Intention Questions",
    'Assumption Questions',
    'Main Idea Questions',
    'Strengthen / Weaken the Argument Questions',
    'Analogous Situation Questions',
    'Tone / Attitude Questions'
  ]
};

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();

  // Detect if viewed from Tutor Panel to route quizzes/exams correctly
  const isTutorContext = location.pathname.startsWith('/tutor');
  const routeBase = isTutorContext ? '/tutor/course-content' : '/student';

  // Detect ACT Full-Length Test course:
  // These are courses with is_practice=true under the ACT main category.
  // They use the new ACTFullLengthExam engine instead of the regular quiz flow.
  const isACTFullLengthCourse = (c) => {
    if (!c) return false;
    const mainCat = (c.main_category || '').toUpperCase();
    const tutorType = (c.tutor_type || '').toUpperCase();
    const category = (c.category || '').toUpperCase();
    const name = (c.name || '').toUpperCase();
    
    return tutorType === 'FULL-LENGTH ACT' || 
           category === 'FULL-LENGTH ACT' || 
           name.includes('ACT FULL-LENGTH') ||
           name.includes('FULL-LENGTH ACT') ||
           (mainCat === 'FULL LENGTH TESTS' && (tutorType.includes('ACT') || category.includes('ACT') || name.includes('ACT')));
  };

  const getACTSectionMaterials = (secKey) => {
    const sectionKeywords = {
      math: ['math'],
      english: ['english'],
      reading: ['reading'],
      science: ['science']
    };
    const keywords = sectionKeywords[secKey] || [secKey];
    
    const matchSection = (upload) => {
      const uSec = (upload.section || '').toLowerCase();
      const uFile = (upload.file_name || '').toLowerCase();
      const uLevel = (upload.level || '').toLowerCase();
      return keywords.some(kw => uSec.includes(kw) || uFile.includes(kw) || uLevel.includes(kw));
    };

    const study = uploads.find(u => matchSection(u) && u.category === 'study_material');
    const video = uploads.find(u => matchSection(u) && u.category === 'video_lecture');
    const quiz = uploads.find(u => matchSection(u) && u.category === 'quiz_document');
    return { study, video, quiz };
  };
  const [course, setCourse] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [courseProgress, setCourseProgress] = useState([]);
  const [courseSubmissions, setCourseSubmissions] = useState([]);
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showEnrollmentKey, setShowEnrollmentKey] = useState(false);
  const [keyCode, setKeyCode] = useState('');
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState('');
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [planAccess, setPlanAccess] = useState([]);
  const [groupAccessIds, setGroupAccessIds] = useState(new Set());
  const [openPdfUnit, setOpenPdfUnit] = useState(null);
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [expandedSubtopic, setExpandedSubtopic] = useState(null);

  useEffect(() => {
    if (user?.id && courseId) {
      checkAccessAndLoad();
    }
  }, [courseId, user]);

  const checkAccessAndLoad = async () => {
    setLoading(true);
    try {
      // TUTOR BYPASS: Tutors can view all course content without enrollment
      const isTutorUser = (user?.role || '').toLowerCase() === 'tutor';

      // 1. Fetch course details and check enrollment in parallel
      const [courseRes, isEnrolledRes, planAccessRes, groupAccessRes] = await Promise.all([
        courseService.getById(courseId),
        isTutorUser
          ? Promise.resolve(true)
          : enrollmentService.isEnrolled(user.id, parseInt(courseId)).catch(err => {
              console.warn('Enrollment check failed:', err);
              return false;
            }),
        planService.getContentAccess(user?.plan_type || 'free').catch(() => ({ data: [] })),
        Promise.resolve(supabase.rpc('get_my_group_granted_course_ids')).catch(() => ({ data: [] }))
      ]);

      const groupIds = new Set(groupAccessRes?.data || []);
      setGroupAccessIds(groupIds);

      const courseData = courseRes.data;
      setCourse(courseData);

      const cCat = (courseData?.category || '').toLowerCase();
      const cTut = (courseData?.tutor_type || '').toLowerCase();
      const cName = (courseData?.name || '').toLowerCase();
      const isLinear = cCat.includes('linear sat') || cTut.includes('linear sat') || cName.includes('linear sat');
      const isFullSAT = courseData?.is_adaptive || cCat.includes('full-length sat') || cTut.includes('full-length sat');

      if (!isTutorContext && (isLinear || isFullSAT)) {
        navigate(`/student/adaptive-pre-test/${courseId}`, { replace: true });
        return;
      }

      const accessData = planAccessRes.data || [];
      setPlanAccess(accessData);

      const userPlan = (user?.plan_type || 'free').toLowerCase();
      let hasTopicAccess = false;
      
      if (userPlan !== 'premium') {
        const assignedTopics = accessData
          .filter(a => a.content_type === 'topic' && a.plan_type === 'free')
          .map(a => a.content_id);

        if (assignedTopics.length > 0) {
          try {
            const { data: topicMaps } = await supabase
              .from('questions')
              .select('course_id')
              .in('topic', assignedTopics)
              .eq('course_id', parseInt(courseId)); // Optimize by just checking this course
            
            if (topicMaps && topicMaps.length > 0) {
              hasTopicAccess = true;
            }
          } catch (e) { console.warn("Topic check failed"); }
        }
      }

      const hasDirectAccess = accessData.some(a => a.content_type === 'course' && String(a.content_id) === String(courseId) && a.plan_type === userPlan);
      const isPremiumUser = userPlan === 'premium';
      const hasGroupAccess = groupIds.has(parseInt(courseId, 10));

      let isEnrolled = isEnrolledRes || hasDirectAccess || hasTopicAccess || isPremiumUser || hasGroupAccess;

      if (!isEnrolled && courseData?.is_demo) isEnrolled = true;

      // 3. Bypass enrollment block for demo courses, tutors, or if already enrolled
      if (!isEnrolled && !courseData?.is_demo && !isTutorUser) {
        try {
          const response = await enrollmentService.initiateEnrollment(user.id, parseInt(courseId));
          if (response.data?.requiresKey || (response.data?.error && response.data.error.includes('key'))) {
            setAccessDenied(true);
            setShowEnrollmentKey(true);
            setLoading(false);
            return;
          }
          
          // If the backend response indicates success or auto-enrollment for free courses
          if (response.data?.enrolled || response.data?.success || response.data?.free) {
            isEnrolled = true;
          }
        } catch (enrollmentError) {
          console.error('Enrollment initiation failed:', enrollmentError);
          
          // FALLBACK: If course is free, attempt direct enrollment via Supabase
          if (courseData?.is_free) {
            try {
              const { error: directError } = await supabase.from('enrollments').insert([{ 
                user_id: user.id, 
                course_id: parseInt(courseId),
                enrolled_at: new Date().toISOString()
              }]);
              
              if (!directError) {
                // Enrollment successful, proceed to load course content
                isEnrolled = true;
              }
            } catch (e) {
              console.error('Direct enrollment fallback failed:', e);
            }
          }

          if (!isEnrolled) {
             if (enrollmentError.response?.data?.error && enrollmentError.response.data.error.includes('key')) {
                setAccessDenied(true);
                setShowEnrollmentKey(true);
                setLoading(false);
                return;
              } else {
                setAccessDenied(true);
                setLockMessage('Service temporarily unavailable. Please try again later.');
                setLoading(false);
                return;
              }
          }
        }
      }

      // If we are here and not enrolled (and not a demo, and not a tutor), we must block
      if (!isEnrolled && !courseData?.is_demo && !isTutorUser) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // 4. Load course content (since access is granted)
      const [uploadsResponse, courseProgressRes, planRes, submissionsRes] = await Promise.all([
        uploadService.getAll({ courseId }),
        progressService.getUserProgress(user.id, courseId),
        planService.getPlan(user.id),
        gradingService.getMyScores(courseId)
      ]);

      if (courseData?.start_date) {
        const startDate = new Date(courseData.start_date);
        const now = new Date();
        if (now < startDate) {
          setAccessDenied(true);
          setShowEnrollmentKey(false);
          setLockMessage(`Course will unlock on ${startDate.toLocaleString()}`);
          setLoading(false);
          return;
        }
      }
      setCourse(courseData);
      setUploads(uploadsResponse.data);

      setCourseProgress(courseProgressRes.data || []);
      setCourseSubmissions(submissionsRes.data?.submissions || []);

      if (planRes.data && planRes.data.diagnostic_data) {
        setDiagnostic(planRes.data.diagnostic_data);
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      if (error.response?.status === 500) {
        setAccessDenied(true);
        setShowEnrollmentKey(false);
        setLoading(false);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentWithKey = async () => {
    if (!keyCode.trim()) {
      setEnrollmentError('Please enter an enrollment key');
      return;
    }

    setEnrollmentLoading(true);
    setEnrollmentError('');

    try {
      const response = await enrollmentService.useKey(keyCode, courseId);

      if (response.data.enrolled) {
        setEnrollmentSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      if (error.response?.data?.error) {
        setEnrollmentError(error.response.data.error);
      } else {
        setEnrollmentError('Failed to use enrollment key. Please try again.');
      }
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const getTopicsForLevel = (level) => {
    const files = uploads.filter(u => u.level === level && u.category === 'study_material');
    if (files.length === 0) return [{ name: 'General Concepts', locked: false }];
    
    const userPlan = user?.plan_type || 'free';
    const isPremium = userPlan === 'premium' && user?.plan_status === 'active';

    return files.map(f => {
      const topicName = f.file_name.replace(/\.[^/.]+$/, '');
      const hasAccess = isPremium || planAccess.some(a => a.content_type === 'topic' && a.content_id === topicName && a.plan_type === userPlan);
      return { name: topicName, locked: !hasAccess };
    });
  };

  const isLevelUnlocked = (level) => {
    if (level === 'Easy') return true;
    if (level === 'Medium') {
      const easy = courseProgress.find(p => p.level === 'Easy');
      return !!(easy && easy.passed);
    }
    if (level === 'Hard') {
      const medium = courseProgress.find(p => p.level === 'Medium');
      return !!(medium && medium.passed);
    }
    return false;
  };

  const getLevelStatus = (level) => {
    const p = courseProgress.find(p => p.level === level);
    if (!p) return { passed: false, score: 0 };
    return { passed: p.passed, score: p.score };
  };

  const getSeqMaterials = (levelName) => {
    const study = uploads.find(u => u.level.toLowerCase() === levelName.toLowerCase() && u.category === 'study_material');
    const video = uploads.find(u => u.level.toLowerCase() === levelName.toLowerCase() && u.category === 'video_lecture');
    const quiz = uploads.find(u => u.level.toLowerCase() === levelName.toLowerCase() && u.category === 'quiz_document');
    return { study, video, quiz };
  };

  const isSeqUnitPassed = (unitName) => {
    const seqTaxonomyEntry = SEQUENTIAL_TAXONOMY[course?.tutor_type] || {};
    const subtopics = !Array.isArray(seqTaxonomyEntry) ? seqTaxonomyEntry[unitName] || [] : [];
    
    if (subtopics.length > 0 && !(subtopics.length === 1 && subtopics[0] === unitName)) {
      return subtopics.every(subtopic => {
        const p = courseProgress.find(p => p.level.toLowerCase() === subtopic.toLowerCase());
        return !!(p && p.score >= 5);
      });
    }

    const p = courseProgress.find(p => p.level.toLowerCase() === unitName.toLowerCase());
    return !!(p && p.score >= 5);
  };

  const getSeqUnitScore = (unitName) => {
    const seqTaxonomyEntry = SEQUENTIAL_TAXONOMY[course?.tutor_type] || {};
    const subtopics = !Array.isArray(seqTaxonomyEntry) ? seqTaxonomyEntry[unitName] || [] : [];
    
    if (subtopics.length > 0 && !(subtopics.length === 1 && subtopics[0] === unitName)) {
      let total = 0;
      let count = 0;
      subtopics.forEach(subtopic => {
        const p = courseProgress.find(p => p.level.toLowerCase() === subtopic.toLowerCase());
        if (p) {
          total += p.score;
          count++;
        }
      });
      return count > 0 ? Math.round(total / count) : null;
    }

    const p = courseProgress.find(p => p.level.toLowerCase() === unitName.toLowerCase());
    return p ? p.score : null;
  };

  const isSeqUnitUnlocked = (unitName, index) => {
    if (index === 0) return true;
    const seqTaxonomyEntry = SEQUENTIAL_TAXONOMY[course?.tutor_type] || [];
    const seqUnitsList = Array.isArray(seqTaxonomyEntry) ? seqTaxonomyEntry : Object.keys(seqTaxonomyEntry);
    const prevUnitName = seqUnitsList[index - 1];
    if (!prevUnitName) return false;
    return isSeqUnitPassed(prevUnitName);
  };

  // Course-level SAT section score using the weighted Easy/Medium/Hard formula.
  const getScoreDisplay = () => {
    if (!course) return { score: 0, max: 800, label: 'Estimated Score' };

    if (isACTFullLengthCourse(course)) {
      let bestComposite = 0;
      (courseSubmissions || []).forEach(sub => {
        if (sub.level === 'Adaptive') {
          const comp = parseInt(sub.scaled_score || 0);
          if (comp > bestComposite) bestComposite = comp;
        }
      });
      return { 
        score: bestComposite, 
        max: 36, 
        label: 'Best ACT Composite Score',
        hasSubmissions: bestComposite > 0 
      };
    }

    const category = getCategory(course);
    const levelScores = { Easy: 0, Medium: 0, Hard: 0 };

    // Prefer submissions for level accuracies, but also consider progress scores.
    (courseSubmissions || []).forEach(sub => {
      const lvl = (sub.level || 'Medium').charAt(0).toUpperCase() + (sub.level || 'Medium').slice(1).toLowerCase();
      if (!['Easy', 'Medium', 'Hard'].includes(lvl)) return;
      const pct = Math.round(sub.raw_score_percentage || 0);
      if (pct > levelScores[lvl]) levelScores[lvl] = pct;
    });

    courseProgress.forEach(p => {
      const lvl = (p.level || 'Medium').charAt(0).toUpperCase() + (p.level || 'Medium').slice(1).toLowerCase();
      if (!['Easy', 'Medium', 'Hard'].includes(lvl)) return;
      const pct = Math.round(p.score || 0);
      if (pct > levelScores[lvl]) levelScores[lvl] = pct;
    });

    const hasLevelScores = levelScores.Easy > 0 || levelScores.Medium > 0 || levelScores.Hard > 0;
    const sectionScore = hasLevelScores
      ? calculateSatScore(levelScores.Easy, levelScores.Medium, levelScores.Hard)
      : (category === 'MATH'
        ? (diagnostic ? parseInt(diagnostic.mathScore) || 200 : 200)
        : (diagnostic ? parseInt(diagnostic.rwScore) || 200 : 200));

    const label = category === 'MATH' ? 'Math Section Score' : 'Reading & Writing Score';
    return { score: sectionScore || 0, max: 800, label };
  };

  const levels = ['Easy', 'Medium', 'Hard'];
  const isSequentialCourse = ['AP', 'ACT'].includes(course?.main_category?.toUpperCase());
  const seqTaxonomyEntry = isSequentialCourse ? (SEQUENTIAL_TAXONOMY[course?.tutor_type] || []) : [];
  const seqUnits = Array.isArray(seqTaxonomyEntry) ? seqTaxonomyEntry : Object.keys(seqTaxonomyEntry);
  const completedSeqUnits = isSequentialCourse ? seqUnits.filter(u => isSeqUnitPassed(u)).length : 0;
  const progressPercent = isSequentialCourse && seqUnits.length > 0 ? Math.round((completedSeqUnits / seqUnits.length) * 100) : 0;

  const passedLevels = courseProgress.filter(p => levels.includes(p.level) && p.passed);
  const uniquePassed = new Set(passedLevels.map(p => p.level));
  const scoreData = getScoreDisplay();
  const isCourseCompleted = isACTFullLengthCourse(course)
    ? !!scoreData.hasSubmissions
    : isSequentialCourse 
      ? (completedSeqUnits === seqUnits.length && seqUnits.length > 0) 
      : uniquePassed.size === 3;

  const renderApActionGrid = (levelName, study, video, quiz, passed) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors">
        <div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <SafeIcon icon={FiIcons.FiFileText} className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Study Materials</h4>
          <p className="text-xs text-slate-500 mt-1">Review official uploaded slides & study PDFs.</p>
        </div>
        <button
          onClick={() => {
            if (study) {
              setOpenPdfUnit(openPdfUnit === levelName ? null : levelName);
            }
          }}
          disabled={!study}
          className={`w-full mt-4 py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            study 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
          }`}
        >
          <SafeIcon icon={FiIcons.FiEye} className="w-3.5 h-3.5" />
          {study ? (openPdfUnit === levelName ? 'Hide PDF' : 'Preview PDF') : 'Not Available'}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors">
        <div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
            <SafeIcon icon={FiIcons.FiVideo} className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Premade Videos</h4>
          <p className="text-xs text-slate-500 mt-1">Watch lectures and core concepts video.</p>
        </div>
        <button
          onClick={() => {
            if (video) {
              navigate(`/student/course/${courseId}/level/${encodeURIComponent(levelName)}/video`);
            }
          }}
          disabled={!video}
          className={`w-full mt-4 py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            video 
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
          }`}
        >
          <SafeIcon icon={FiIcons.FiPlay} className="w-3.5 h-3.5 fill-current" />
          {video ? 'Watch Video' : 'Not Available'}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors">
        <div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <SafeIcon icon={FiIcons.FiEdit3} className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Practice Quiz</h4>
          <p className="text-xs text-slate-500 mt-1">Train untimed with unlimited retry mode.</p>
        </div>
        <button
          onClick={() => {
            if (quiz) {
              navigate(`${routeBase}/course/${courseId}/level/${encodeURIComponent(levelName)}/quiz?mode=practice`);
            }
          }}
          disabled={!quiz}
          className={`w-full mt-4 py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            quiz 
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
          }`}
        >
          <SafeIcon icon={FiIcons.FiLayers} className="w-3.5 h-3.5" />
          {quiz ? 'Practice Mode' : 'Not Available'}
        </button>
      </div>

      <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 transition-colors">
        <div>
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-3">
            <SafeIcon icon={FiIcons.FiCheckCircle} className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">Take the Quiz</h4>
          <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">Complete the graded exam.</p>
        </div>
        <button
          onClick={() => {
            if (quiz) {
              // ACT Full-Length courses use the dedicated ACT exam engine
              if (isACTFullLengthCourse(course)) {
                navigate(`${routeBase}/act-full-length-test/${courseId}`);
              } else {
                navigate(`${routeBase}/course/${courseId}/level/${encodeURIComponent(levelName)}/quiz`);
              }
            }
          }}
          disabled={!quiz && !isACTFullLengthCourse(course)}
          className={`w-full mt-4 py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            (quiz || isACTFullLengthCourse(course))
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
          }`}
        >
          <SafeIcon icon={FiIcons.FiAward} className="w-3.5 h-3.5" />
          {(quiz || isACTFullLengthCourse(course)) ? (passed ? 'Retake Exam' : 'Start Exam') : 'Not Available'}
        </button>
      </div>
    </div>
  );

  const renderPdfPreview = (levelName, study) => (
    <AnimatePresence>
      {openPdfUnit === levelName && study && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800"
          onContextMenu={(e) => e.preventDefault()}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              iframe, embed, object, [class*="InlineReader"], .no-print {
                display: none !important;
              }
            }
          `}} />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FiIcons.FiFileText className="text-indigo-600" /> Study Guide Inline Reader
            </span>
            <button 
              onClick={() => setOpenPdfUnit(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-2 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow-sm"
            >
              Close Preview
            </button>
          </div>
          <iframe 
            src={`${study.file_url}#toolbar=0`} 
            className="w-full h-[600px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white" 
            title={`PDF Preview - ${levelName}`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (loading) return <div className="p-12 text-center text-gray-500 font-bold">Refreshing data...</div>;
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200 max-w-md w-full">
          {!showEnrollmentKey ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SafeIcon icon={FiShield} className="w-8 h-8 text-[#E53935]" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2 text-center">Access Denied</h2>
              <p className="text-gray-600 mb-6 font-medium text-center">{lockMessage || 'You are not enrolled in this course.'}</p>
              <Link to="/student" className="text-[#E53935] hover:text-[#b71c1c] font-bold block text-center">Return to Dashboard Now</Link>
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <SafeIcon icon={FiKey} className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Enrollment Required</h2>
                <p className="text-gray-600 mb-6 font-medium">This course requires an enrollment key to access</p>
              </div>

              {enrollmentSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
                  <SafeIcon icon={FiCheckCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm mb-1">Success!</p>
                    <p className="text-sm">You've been enrolled in the course. Redirecting...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="enrollmentKey" className="block text-sm font-semibold text-gray-700 mb-2">
                      Enrollment Key
                    </label>
                    <input
                      type="text"
                      id="enrollmentKey"
                      value={keyCode}
                      onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                      placeholder="ENTER-KEY-HERE"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg tracking-wider font-mono"
                      disabled={enrollmentLoading}
                    />
                  </div>

                  {enrollmentError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                      <SafeIcon icon={FiAlertCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{enrollmentError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleEnrollmentWithKey}
                    disabled={enrollmentLoading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold shadow-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
                  >
                    {enrollmentLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                        Enrolling...
                      </span>
                    ) : (
                      'Enroll with Key'
                    )}
                  </button>
                </>
              )}

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Don't have an enrollment key?
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Ask your tutor or administrator for a key</li>
                  <li>• Check your email for an invitation link</li>
                  <li>• Enrollment keys are usually 10-15 characters</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!course) return <div className="p-12 text-center text-gray-500 font-bold">Course not found</div>;

  return (
    <div className={`min-h-screen pb-12 relative ${course?.is_adaptive ? 'bg-[#f8f9fc]' : 'bg-[#FAFAFA]'}`}>
      {course?.is_adaptive && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-200/20 to-purple-200/20 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-blue-200/20 to-indigo-200/20 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.2]" style={{ backgroundImage: 'radial-gradient(#5b42f3 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}></div>
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {course?.is_adaptive ? null : (
          <div className="mb-10 text-center px-4 sm:px-0 flex flex-col items-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 tracking-tight">
              <span className={isACTFullLengthCourse(course) ? "text-slate-900 uppercase" : isSequentialCourse ? "text-indigo-600" : "text-[#282C4D]"}>
                {isACTFullLengthCourse(course) ? "ACT FULL-LENGTH TEST" : course.name}
              </span>
            </h1>
            {!isACTFullLengthCourse(course) && (
              <p className="text-[#64748B] text-sm sm:text-base font-normal">
                {isSequentialCourse 
                    ? "Complete each unit's quiz with ≥5% to unlock the next unit."
                    : "Complete each level to unlock the next difficulty."}
              </p>
            )}
          </div>
        )}

        {isACTFullLengthCourse(course) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 bg-gradient-to-br from-red-950 via-slate-900 to-red-900 text-white p-6 sm:p-10 rounded-3xl shadow-xl border border-red-900/50 text-center relative overflow-hidden mx-4 sm:mx-0"
          >
            <div className="relative z-10 flex flex-col items-center">
              {isCourseCompleted && (
                <div className="bg-red-500 text-white p-2.5 rounded-full mb-6 shadow-lg shadow-red-500/50 animate-bounce">
                  <SafeIcon icon={FiAward} className="w-6 h-6" />
                </div>
              )}

              <div className="flex flex-col items-center gap-3 mb-6">
                <span className="text-gray-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">{scoreData.label}</span>
                {isCourseCompleted && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] bg-green-900/50 text-green-400 border border-green-800 font-black uppercase tracking-widest animate-pulse">
                    <SafeIcon icon={FiTrendingUp} className="w-3.5 h-3.5 mr-2" /> Performance Unlocked
                  </span>
                )}
              </div>

              <div className="inline-block bg-white/5 backdrop-blur-xl p-6 sm:p-10 px-8 sm:px-16 rounded-[2rem] border border-white/10 transform hover:scale-105 transition-all cursor-default shadow-inner">
                {isCourseCompleted ? (
                  <div className="text-4xl sm:text-7xl font-black text-red-500 tracking-tighter">
                    {scoreData.score} <span className="text-base sm:text-2xl text-white/30 font-bold uppercase tracking-widest">/ {scoreData.max}</span>
                  </div>
                ) : (
                  <div className="text-xs sm:text-lg font-black text-gray-500 tracking-[0.1em] uppercase py-2 sm:py-4">
                    Complete the Test to Reveal Score
                  </div>
                )}
              </div>
            </div>

            <div className="absolute top-0 left-0 w-full h-full opacity-35 pointer-events-none">
              <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-red-700 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-orange-600 rounded-full blur-[100px]"></div>
            </div>
          </motion.div>
        ) : isSequentialCourse ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 sm:p-10 rounded-3xl shadow-xl border border-indigo-900/50 text-center relative overflow-hidden mx-4 sm:mx-0"
          >
            <div className="relative z-10 flex flex-col items-center">
              {isCourseCompleted && (
                <div className="bg-emerald-500 text-white p-2.5 rounded-full mb-6 shadow-lg shadow-emerald-500/50 animate-bounce">
                  <SafeIcon icon={FiAward} className="w-6 h-6" />
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black">{completedSeqUnits} of {seqUnits.length} Units Mastered</h3>
                  <p className="text-indigo-100 font-medium mt-1">
                    Your overall progress for {course.tutor_type}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md bg-white/10 rounded-full h-3 mb-6 p-0.5 overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full"
                />
              </div>

              <div className="inline-block bg-white/5 backdrop-blur-xl p-4 sm:p-6 px-8 sm:px-12 rounded-2xl border border-white/10 cursor-default shadow-inner">
                <div className="text-3xl sm:text-5xl font-black text-emerald-400 tracking-tighter">
                  {progressPercent}% <span className="text-xs sm:text-sm text-white/50 font-bold uppercase tracking-widest">Completed</span>
                </div>
              </div>
            </div>

            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
              <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-emerald-600 rounded-full blur-[100px]"></div>
            </div>
          </motion.div>
        ) : course.is_adaptive ? null : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 bg-[#15112f] text-white p-6 sm:p-8 rounded-2xl shadow-lg border-0 text-center relative overflow-hidden mx-4 sm:mx-0"
          >
            <div className="relative z-10 flex flex-col items-center">
              {isCourseCompleted && (
                <div className="bg-[#E53935] text-white p-2.5 rounded-full mb-6 shadow-lg shadow-red-500/50 animate-bounce">
                  <SafeIcon icon={FiAward} className="w-6 h-6" />
                </div>
              )}

              <div className="flex flex-col items-center gap-3 mb-4">
                <span className="text-gray-300 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">{scoreData.label}</span>
                {isCourseCompleted && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] bg-green-900/50 text-green-400 border border-green-800 font-bold uppercase tracking-widest animate-pulse">
                    <SafeIcon icon={FiTrendingUp} className="w-3.5 h-3.5 mr-2" /> Performance Unlocked
                  </span>
                )}
              </div>

              <div className="inline-block bg-[#242145] p-3 sm:p-4 px-8 sm:px-12 rounded-xl border border-white/5 transform transition-all cursor-default shadow-inner">
                {isCourseCompleted ? (
                  <div className="text-4xl sm:text-7xl font-black text-[#E53935] tracking-tighter">
                    {scoreData.score} <span className="text-base sm:text-2xl text-white/30 font-bold uppercase tracking-widest">/ {scoreData.max}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3 text-sm font-bold text-white py-1">
                    <SafeIcon icon={FiLock} className="w-4 h-4 text-gray-400" /> Complete all levels to reveal score
                  </div>
                )}
              </div>
            </div>

            <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none">
              <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-pink-600/30 rounded-full blur-[100px]"></div>
              <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-blue-600/30 rounded-full blur-[80px]"></div>
            </div>
          </motion.div>
        )}

        {isACTFullLengthCourse(course) ? (
          <div className="space-y-10 px-4 sm:px-0">
            <div className="bg-[#1e2330] p-8 sm:p-12 rounded-3xl shadow-2xl border border-white/5 text-center relative overflow-hidden">
               <div className="relative z-10">
                 <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md transform rotate-12">
                   <SafeIcon icon={FiTarget} className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
                 </div>
                 <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] bg-red-900/30 text-red-400 border border-red-800 font-black uppercase tracking-widest mb-4">
                   Official ACT Format
                 </span>
                 <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 uppercase tracking-tight">ACT FULL-LENGTH TEST</h2>
                 <p className="text-slate-300 text-sm sm:text-lg mb-8 max-w-2xl mx-auto font-medium">
                   This is a complete full-length ACT Practice Test containing Mathematics (45 Qs, 50m), English (50 Qs, 35m), a 15-minute break, Reading (36 Qs, 40m), and an optional Science section (40 Qs, 40m).
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => navigate(`${routeBase}/act-full-length-test/${courseId}`)}
                      className="w-full sm:w-auto px-10 py-4 bg-red-600 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-red-500/20 hover:-translate-y-1"
                    >
                      Take the Quiz
                    </button>
                 </div>
               </div>
               <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                 <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-red-700 rounded-full blur-[120px]"></div>
                 <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-orange-600 rounded-full blur-[100px]"></div>
               </div>
            </div>
            <div className="bg-[#1e2330] p-8 sm:p-12 rounded-3xl shadow-2xl border border-white/5 text-center relative overflow-hidden">
               <div className="relative z-10">
                 <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md transform rotate-12">
                   <SafeIcon icon={FiIcons.FiZap || FiTarget} className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
                 </div>
                 <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] bg-amber-900/30 text-amber-400 border border-amber-800 font-black uppercase tracking-widest mb-4">
                   Practice Exam Mode
                 </span>
                 <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 uppercase tracking-tight">ACT PRACTICE TEST</h2>
                 <p className="text-slate-300 text-sm sm:text-lg mb-8 max-w-2xl mx-auto font-medium">
                   Practice the full exam sequentially with fixed timers, sections, and score conversion. The practice test mimics the official exam format containing Mathematics, English, Reading, and Science.
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => navigate(`${routeBase}/act-full-length-test/${courseId}?mode=practice`)}
                      className="w-full sm:w-auto px-10 py-4 bg-amber-500 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-xl hover:bg-amber-600 transition-all shadow-lg hover:shadow-amber-500/20 hover:-translate-y-1"
                    >
                      Practice Quiz
                    </button>
                 </div>
               </div>
               <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                 <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-amber-500 rounded-full blur-[120px]"></div>
                 <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-yellow-500 rounded-full blur-[100px]"></div>
               </div>
            </div>
          </div>
        ) : course.is_adaptive ? (
          <div className="space-y-10 mx-4 sm:mx-0">
            
            {/* Header for Adaptive */}
            <div className="text-center flex flex-col items-center mt-4 mb-8">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase">
                {course.name}
              </h1>
              <p className="text-slate-600 text-sm sm:text-base font-medium">
                Complete each level to unlock the next difficulty.
              </p>
              <div className="w-12 h-1 bg-[#5b42f3] rounded-full mt-4"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Card: Full Length Test Info */}
              <div className="bg-gradient-to-br from-[#5b42f3] to-[#422bc7] p-8 sm:p-10 rounded-3xl border border-indigo-400/20 relative overflow-hidden flex flex-col shadow-xl shadow-indigo-500/20">
                <div className="relative z-10 flex flex-col h-full items-start text-left">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-sm text-[#5b42f3]">
                    <SafeIcon icon={FiTarget} className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">FULL LENGTH TEST</h2>
                  <p className="text-indigo-100/90 text-sm sm:text-base mb-8 font-normal leading-relaxed flex-1">
                    This is a full-length SAT test containing Reading & Writing and Math sections. The difficulty of the second module will adapt based on your performance in the first module.
                  </p>
                  <button
                    onClick={() => navigate(`${routeBase}/adaptive-pre-test/${courseId}`)}
                    className="bg-white text-[#5b42f3] font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-xl hover:bg-slate-50 transition-colors shadow-lg shadow-black/10 w-full sm:w-auto self-start flex items-center justify-center"
                  >
                    START FULL-LENGTH TEST <span className="ml-2 font-black">&gt;</span>
                  </button>
                </div>
                {/* Subtle wave/dot pattern inside */}
                <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, #ffffff 20%, transparent 21%)', backgroundSize: '15px 15px' }}></div>
                <div className="absolute bottom-[-30%] right-[-10%] w-[400px] h-[400px] bg-white/10 rounded-full blur-[80px] pointer-events-none"></div>
              </div>

              {/* Right Card: Score */}
              <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-slate-200/70 flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center w-full">
                  <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-purple-100 text-purple-600">
                    <SafeIcon icon={FiIcons.FiBarChart2 || FiTrendingUp} className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6">{scoreData.label}</h3>
                  
                  <div className="bg-slate-50/70 border border-slate-100 p-8 rounded-2xl w-full max-w-sm flex flex-col items-center justify-center min-h-[160px]">
                    {isCourseCompleted ? (
                      <div className="text-5xl font-black text-slate-800 tracking-tighter">
                        {scoreData.score}
                      </div>
                    ) : (
                      <>
                        <SafeIcon icon={FiLock} className="w-6 h-6 text-purple-500 mb-4" />
                        <span className="text-[10px] font-bold text-slate-600 tracking-widest uppercase leading-loose">
                          Complete all levels<br/>to reveal score
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Preparation Materials Section */}
            <div id="preparation-materials" className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-sm border border-slate-200/70 mt-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3 mb-8">
                <SafeIcon icon={FiIcons.FiBookOpen || FiIcons.FiBook} className="text-purple-600 w-5 h-5" />
                Preparation & Study Materials
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                {[
                  { section: 'Reading & Writing', levels: ['Moderate', 'Easy', 'Hard'] },
                  { section: 'Math', levels: ['Moderate', 'Easy', 'Hard'] }
                ].map((sec) => (
                  <div key={sec.section} className="space-y-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-purple-600 border-b-2 border-purple-600 pb-2 inline-block mb-2">
                      {sec.section}
                    </h4>
                    <div className="space-y-3">
                      {sec.levels.map(level => {
                        const study = uploads.find(u => u.section === (sec.section.includes('Read') ? 'reading_writing' : 'math') && u.level === level && u.category === 'study_material');
                        const video = uploads.find(u => u.section === (sec.section.includes('Read') ? 'reading_writing' : 'math') && u.level === level && u.category === 'video_lecture');
                        
                        return (
                          <div key={level} className="bg-white p-3.5 px-4 rounded-xl border border-slate-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-200 transition-colors">
                            <div className="flex items-center gap-3">
                              <SafeIcon icon={FiIcons.FiFileText} className="w-4 h-4 text-purple-500" />
                              <span className="font-semibold text-sm text-slate-800">{level} Module</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {study ? (
                                <a href={`${study.file_url}#toolbar=0`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase">
                                  <SafeIcon icon={FiIcons.FiFileText} className="w-3 h-3" /> PDF
                                </a>
                              ) : (
                                <span className="px-3 py-1.5 text-slate-400 bg-slate-50/50 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-not-allowed">
                                  <SafeIcon icon={FiIcons.FiFileText} className="w-3 h-3" /> No PDF
                                </span>
                              )}
                              {video ? (
                                <Link to={`${routeBase}/course/${courseId}/level/${level.toLowerCase()}/video?section=${sec.section.includes('Read') ? 'reading_writing' : 'math'}`} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase">
                                  <SafeIcon icon={FiIcons.FiPlay} className="w-3 h-3" /> Video
                                </Link>
                              ) : (
                                <span className="px-3 py-1.5 text-slate-400 bg-slate-50/50 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-not-allowed">
                                  <SafeIcon icon={FiIcons.FiPlay} className="w-3 h-3" /> No Video
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isSequentialCourse ? (
          <div className="space-y-6">
            {seqUnits.map((unitName, index) => {
              const unlocked = isSeqUnitUnlocked(unitName, index);
              const passed = isSeqUnitPassed(unitName);
              const score = getSeqUnitScore(unitName);
              const { study, video, quiz } = getSeqMaterials(unitName);

              const seqTaxonomyEntry = SEQUENTIAL_TAXONOMY[course?.tutor_type] || {};
              const subtopics = !Array.isArray(seqTaxonomyEntry) ? seqTaxonomyEntry[unitName] || [] : [];
              const isSubtopicLevel = subtopics.length > 0 && !(subtopics.length === 1 && subtopics[0] === unitName);
              
              const isExpanded = expandedUnit === unitName;

              return (
                <motion.div
                  key={unitName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all relative ${
                    !unlocked ? 'opacity-65 grayscale cursor-not-allowed' : ''
                  }`}
                >
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-50/50 dark:bg-slate-950/40 backdrop-blur-[1px] rounded-2xl">
                      <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-lg border border-slate-100 dark:border-slate-700">
                        <SafeIcon icon={FiLock} className="w-6 h-6 text-slate-400" />
                      </div>
                    </div>
                  )}

                  <div 
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isSubtopicLevel ? (unlocked ? 'cursor-pointer' : '') : ''} ${unlocked && !isSubtopicLevel ? 'border-b border-slate-50 dark:border-slate-800/60 pb-4 mb-4' : ''}`}
                    onClick={() => {
                      if (isSubtopicLevel && unlocked) {
                        setExpandedUnit(isExpanded ? null : unitName);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-md flex-shrink-0 bg-indigo-600`}>
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {unitName}
                          {isSubtopicLevel && (
                            <SafeIcon icon={isExpanded ? FiIcons.FiChevronUp : FiIcons.FiChevronDown} className="w-5 h-5 text-slate-400" />
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold uppercase mt-0.5 tracking-wider">
                          Course Curriculum Unit
                        </p>
                      </div>
                    </div>

                    {passed && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-500">Best Score: {score}%</span>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 p-1.5 rounded-lg flex items-center gap-1.5 px-3 text-xs font-bold border border-emerald-100 dark:border-emerald-900/30">
                          <SafeIcon icon={FiCheckCircle} className="w-3.5 h-3.5" /> Passed
                        </div>
                      </div>
                    )}
                  </div>

                  {unlocked && (
                    <div className="space-y-4">
                      {isSubtopicLevel ? (
                        isExpanded && (
                          <div className="flex flex-col gap-3 mt-4 border-t border-slate-50 dark:border-slate-800/60 pt-4">
                            {subtopics.map((subtopic, subIdx) => {
                              const subPassed = isSeqUnitPassed(subtopic);
                              const subScore = getSeqUnitScore(subtopic);
                              const isSubExpanded = expandedSubtopic === subtopic;
                              const { study: subStudy, video: subVideo, quiz: subQuiz } = getSeqMaterials(subtopic);
                              
                              return (
                                <div key={subtopic} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 p-4 transition-all">
                                  <div 
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedSubtopic(isSubExpanded ? null : subtopic)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-bold text-slate-500">{index + 1}.{subIdx + 1}</span>
                                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{subtopic}</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {subPassed && (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 p-1 px-2 rounded-lg text-xs font-bold border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1">
                                          <SafeIcon icon={FiCheckCircle} className="w-3 h-3" /> Passed
                                        </div>
                                      )}
                                      <SafeIcon icon={isExpanded ? FiIcons.FiChevronUp : FiIcons.FiChevronDown} className="w-5 h-5 text-slate-400" />
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                      {renderApActionGrid(subtopic, subStudy, subVideo, subQuiz, subPassed)}
                                      {renderPdfPreview(subtopic, subStudy)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <>
                          {renderApActionGrid(unitName, study, video, quiz, passed)}
                          {renderPdfPreview(unitName, study)}
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {['Easy', 'Medium', 'Hard'].map((level, index) => {
              const unlocked = isLevelUnlocked(level);
              const { passed, score } = getLevelStatus(level);
              const roundedScore = Math.round(score || 0);

              const lockedClass = !unlocked ? 'opacity-80 cursor-not-allowed grayscale' : '';

              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative ${lockedClass} flex flex-col md:flex-row md:items-center justify-between gap-6`}
                >
                  {/* Left Column: Icon and Text */}
                  <div className="flex items-center gap-4 w-64 shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm bg-green-600 shrink-0">
                      {index + 1}
                    </div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-50 shrink-0">
                      <SafeIcon icon={FiIcons.FiBarChart2 || FiIcons.FiTrendingUp} className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-extrabold text-[#282C4D]">
                        {level} Level
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">General Concepts</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Score and Progress Bar */}
                  <div className="flex-1 flex flex-col justify-center max-w-xs md:mx-auto">
                    {passed ? (
                      <>
                        <span className="text-[10px] font-bold text-gray-500 tracking-wide mb-1">Best Score</span>
                        <span className="text-xl font-bold text-green-600 leading-none mb-2">{roundedScore}%</span>
                        
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className="w-full bg-green-100 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: `${roundedScore}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-gray-700">{roundedScore}%</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <SafeIcon icon={FiIcons.FiCheckCircle} className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-[10px] font-bold text-green-600">Passed</span>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        {!unlocked && (
                           <div className="bg-white p-2 rounded-full shadow-sm border border-gray-100 flex items-center justify-center">
                             <SafeIcon icon={FiIcons.FiLock} className="w-4 h-4 text-gray-400" />
                           </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Button */}
                  <div className="flex items-center justify-end w-full md:w-auto shrink-0">
                    <button
                      onClick={() => unlocked && navigate(`${routeBase}/course/${courseId}/level/${level}`)}
                      disabled={!unlocked}
                      className={`w-full md:w-auto px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all border ${
                        unlocked 
                          ? 'bg-white text-green-700 border-green-200 hover:bg-green-50 shadow-sm' 
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <SafeIcon icon={FiIcons.FiPlay} className="w-4 h-4 fill-current" />
                          {passed ? `Retake ${level}` : `Start ${level}`}
                        </>
                      ) : (
                        <>
                          <SafeIcon icon={FiIcons.FiLock} className="w-4 h-4" />
                          Locked
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link to={isTutorContext ? '/tutor/course-content' : '/student'} className="text-gray-500 hover:text-black font-bold flex items-center justify-center gap-2 transition-colors">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CourseView;

