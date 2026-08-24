import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import { TAXONOMY } from '../../utils/taxonomy';

const { FiCheck, FiMinus, FiChevronDown, FiChevronRight } = FiIcons;

const HierarchicalContentSelector = ({ courses = [], initialContent = {}, onChange }) => {
  // We add "Full-Length Tests" dynamically to the hierarchy
  const testCourses = courses.filter(c => c.main_category === 'FULL LENGTH TESTs' || c.name.toLowerCase().includes('full length test'));
  
  const hierarchy = { ...TAXONOMY };
  if (testCourses.length > 0) {
    hierarchy['Full-Length Tests'] = {
      'All Full-Length Tests': testCourses.map(c => c.name)
    };
  }

  // Normalize initialContent to 4-level structure if needed
  const normalizeInitialContent = (raw) => {
    if (!raw || typeof raw !== 'object') return {};
    const normalized = {};

    Object.entries(raw).forEach(([mainCat, subCats]) => {
      if (typeof subCats !== 'object') return;
      normalized[mainCat] = {};

      Object.entries(subCats).forEach(([subCat, domainVal]) => {
        normalized[mainCat][subCat] = {};

        if (Array.isArray(domainVal)) {
          // Old format: domainVal is array of domain strings e.g. ["Algebra"]
          domainVal.forEach(domName => {
            const taxonomySubtopics = hierarchy[mainCat]?.[subCat]?.[domName];
            if (Array.isArray(taxonomySubtopics)) {
              normalized[mainCat][subCat][domName] = [...taxonomySubtopics];
            } else {
              normalized[mainCat][subCat][domName] = [domName];
            }
          });
        } else if (typeof domainVal === 'object') {
          // New format: domainVal is { "Algebra": ["Linear equations in one variable", ...] }
          Object.entries(domainVal).forEach(([domName, subList]) => {
            if (Array.isArray(subList)) {
              normalized[mainCat][subCat][domName] = [...subList];
            }
          });
        }
      });
    });

    return normalized;
  };

  const [selected, setSelected] = useState(() => normalizeInitialContent(initialContent));
  const [expanded, setExpanded] = useState({ 'SAT': true, 'SAT:SAT Math': true, 'SAT:SAT Reading & Writing': true });
  const [search, setSearch] = useState('');

  // Notify parent whenever selection changes
  useEffect(() => {
    const courseIds = new Set();

    Object.entries(selected).forEach(([mainCat, subCats]) => {
      Object.entries(subCats).forEach(([subCat, domainsMap]) => {
        Object.entries(domainsMap).forEach(([domName, subtopicsList]) => {
          if (mainCat === 'Full-Length Tests') {
            subtopicsList.forEach(tName => {
              const course = testCourses.find(c => c.name === tName);
              if (course) courseIds.add(course.id);
            });
          } else {
            subtopicsList.forEach(subtopicName => {
              const subNameLower = subtopicName.toLowerCase().trim();
              // Exact match first, across the whole list, before ever falling back to a loose
              // substring check - e.g. "Linear functions" is a substring of "Nonlinear functions",
              // and "Linear equations in two variables" is a substring of "Systems of two linear
              // equations in two variables", so checking substrings first (or short-circuiting on
              // the first .find() hit) can match the wrong course even when an exact match exists.
              const matchedCourse =
                courses.find(c => {
                  const cName = (c.name || '').toLowerCase().trim();
                  const cCat = (c.category || '').toLowerCase().trim();
                  return cName === subNameLower || cCat === subNameLower;
                }) ||
                courses.find(c => {
                  const cName = (c.name || '').toLowerCase().trim();
                  return cName.includes(subNameLower) || subNameLower.includes(cName);
                });

              if (matchedCourse) {
                courseIds.add(matchedCourse.id);
              }
            });
          }
        });
      });
    });

    onChange({
      assigned_content: selected,
      assigned_course_ids: Array.from(courseIds)
    });
  }, [selected, courses]);

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper: check state of a domain
  const getDomainState = (mainCat, subCat, domName) => {
    const selectedSubtopics = selected[mainCat]?.[subCat]?.[domName] || [];
    let totalSubtopics = 0;

    if (mainCat === 'Full-Length Tests') {
      totalSubtopics = 1;
    } else {
      const taxonomyList = hierarchy[mainCat]?.[subCat]?.[domName];
      totalSubtopics = Array.isArray(taxonomyList) ? taxonomyList.length : 1;
    }

    if (selectedSubtopics.length === 0) return 'unchecked';
    if (selectedSubtopics.length >= totalSubtopics) return 'checked';
    return 'indeterminate';
  };

  // Helper: check state of a subcategory (SAT Math)
  const getSubCatState = (mainCat, subCat) => {
    const domainsMap = hierarchy[mainCat]?.[subCat] || {};
    let domainKeys = [];

    if (mainCat === 'Full-Length Tests') {
      domainKeys = domainsMap;
    } else {
      domainKeys = Object.keys(domainsMap);
    }

    if (domainKeys.length === 0) return 'unchecked';

    const states = domainKeys.map(dom => getDomainState(mainCat, subCat, dom));
    const allChecked = states.every(s => s === 'checked');
    const allUnchecked = states.every(s => s === 'unchecked');

    if (allChecked) return 'checked';
    if (allUnchecked) return 'unchecked';
    return 'indeterminate';
  };

  // Toggle whole domain (e.g. Algebra)
  const toggleDomain = (mainCat, subCat, domName, isChecked) => {
    setSelected(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[mainCat]) next[mainCat] = {};
      if (!next[mainCat][subCat]) next[mainCat][subCat] = {};

      if (isChecked) {
        if (mainCat === 'Full-Length Tests') {
          next[mainCat][subCat][domName] = [domName];
        } else {
          const taxonomyList = hierarchy[mainCat]?.[subCat]?.[domName] || [domName];
          next[mainCat][subCat][domName] = [...taxonomyList];
        }
      } else {
        delete next[mainCat][subCat][domName];
        if (Object.keys(next[mainCat][subCat]).length === 0) delete next[mainCat][subCat];
        if (Object.keys(next[mainCat]).length === 0) delete next[mainCat];
      }

      return next;
    });
  };

  // Toggle single subtopic
  const updateSubtopicSelection = (mainCat, subCat, domName, subtopic, isChecked) => {
    setSelected(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[mainCat]) next[mainCat] = {};
      if (!next[mainCat][subCat]) next[mainCat][subCat] = {};
      if (!next[mainCat][subCat][domName]) next[mainCat][subCat][domName] = [];

      if (isChecked) {
        if (!next[mainCat][subCat][domName].includes(subtopic)) {
          next[mainCat][subCat][domName].push(subtopic);
        }
      } else {
        next[mainCat][subCat][domName] = next[mainCat][subCat][domName].filter(s => s !== subtopic);
        if (next[mainCat][subCat][domName].length === 0) {
          delete next[mainCat][subCat][domName];
          if (Object.keys(next[mainCat][subCat]).length === 0) delete next[mainCat][subCat];
          if (Object.keys(next[mainCat]).length === 0) delete next[mainCat];
        }
      }

      return next;
    });
  };

  // Toggle SubCategory (e.g. SAT Math)
  const toggleSubCat = (mainCat, subCat, isChecked) => {
    const domainsMap = hierarchy[mainCat]?.[subCat] || {};
    let domainKeys = [];

    if (mainCat === 'Full-Length Tests') {
      domainKeys = domainsMap;
    } else {
      domainKeys = Object.keys(domainsMap);
    }

    domainKeys.forEach(domName => {
      toggleDomain(mainCat, subCat, domName, isChecked);
    });
  };

  const clearAll = () => setSelected({});

  // Count total selected subtopics
  let totalSelected = 0;
  Object.values(selected).forEach(subCats => {
    Object.values(subCats).forEach(domainsMap => {
      Object.values(domainsMap).forEach(subList => {
        totalSelected += subList.length;
      });
    });
  });

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col max-h-[520px]">
      <div className="p-3 border-b border-gray-700 bg-gray-900/50">
        <input 
          type="text" 
          placeholder="🔍 Search courses or topics..." 
          className="w-full bg-gray-700 border-none text-white rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-y-auto p-4 flex-1 space-y-2">
        {Object.entries(hierarchy).map(([mainCat, subCats]) => {
          const mainKey = mainCat;

          return (
            <div key={mainCat} className="mb-2">
              {/* Level 1: SAT */}
              <div 
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded-lg text-gray-200 font-bold text-base"
                onClick={() => toggleExpand(mainKey)}
              >
                {expanded[mainKey] ? <FiChevronDown /> : <FiChevronRight />}
                {mainCat}
              </div>

              {expanded[mainKey] && (
                <div className="ml-4 mt-1 border-l border-gray-700 pl-4 space-y-3">
                  {Object.entries(subCats).map(([subCat, domainsMap]) => {
                    const subKey = `${mainCat}:${subCat}`;
                    const subCatState = getSubCatState(mainCat, subCat);

                    return (
                      <div key={subCat} className="mb-2">
                        {/* Level 2: SAT Math */}
                        <div className="flex items-center justify-between group py-1">
                          <label className="flex items-center gap-3 cursor-pointer text-gray-200 hover:text-white">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${subCatState === 'checked' ? 'bg-blue-600 border-blue-600' : subCatState === 'indeterminate' ? 'bg-blue-600/50 border-blue-600' : 'border-gray-500 bg-gray-800'}`}>
                              {subCatState === 'checked' && <FiCheck className="text-white text-xs" />}
                              {subCatState === 'indeterminate' && <FiMinus className="text-white text-xs" />}
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={subCatState === 'checked'}
                                onChange={(e) => toggleSubCat(mainCat, subCat, e.target.checked || subCatState === 'indeterminate')}
                              />
                            </div>
                            <span 
                              className="font-bold text-sm select-none flex items-center gap-1.5 cursor-pointer hover:text-blue-400"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleExpand(subKey);
                              }}
                            >
                              {expanded[subKey] ? <FiChevronDown className="w-4 h-4 text-gray-400" /> : <FiChevronRight className="w-4 h-4 text-gray-400" />}
                              {subCat}
                            </span>
                          </label>
                        </div>

                        {/* Level 3: Domains (Algebra, Advanced Math, etc.) */}
                        {(expanded[subKey] || subCatState !== 'unchecked') && (
                          <div className="ml-6 mt-1 border-l border-gray-700/60 pl-4 space-y-2">
                            {mainCat === 'Full-Length Tests' ? (
                              domainsMap.map(testName => {
                                const isChecked = (selected[mainCat]?.[subCat]?.[testName] || []).includes(testName);
                                return (
                                  <label key={testName} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-white py-1">
                                    <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-500 bg-gray-800'}`}>
                                      {isChecked && <FiCheck className="text-white text-[10px]" />}
                                      <input 
                                        type="checkbox"
                                        className="hidden"
                                        checked={isChecked}
                                        onChange={(e) => toggleDomain(mainCat, subCat, testName, e.target.checked)}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold select-none">{testName}</span>
                                  </label>
                                );
                              })
                            ) : (
                              Object.entries(domainsMap).map(([domName, subtopicsList]) => {
                                const domKey = `${mainCat}:${subCat}:${domName}`;
                                const domState = getDomainState(mainCat, subCat, domName);
                                const selectedSubCount = (selected[mainCat]?.[subCat]?.[domName] || []).length;
                                const totalSubCount = subtopicsList.length;

                                if (search && !domName.toLowerCase().includes(search.toLowerCase()) && !subtopicsList.some(s => s.toLowerCase().includes(search.toLowerCase()))) {
                                  return null;
                                }

                                return (
                                  <div key={domName} className="mb-1">
                                    <div className="flex items-center justify-between group py-1">
                                      <label className="flex items-center gap-2.5 cursor-pointer text-gray-300 hover:text-white">
                                        <div className={`w-4 h-4 rounded-sm flex items-center justify-center border transition-colors ${domState === 'checked' ? 'bg-blue-600 border-blue-600' : domState === 'indeterminate' ? 'bg-blue-600/50 border-blue-600' : 'border-gray-500 bg-gray-800'}`}>
                                          {domState === 'checked' && <FiCheck className="text-white text-[10px]" />}
                                          {domState === 'indeterminate' && <FiMinus className="text-white text-[10px]" />}
                                          <input 
                                            type="checkbox"
                                            className="hidden"
                                            checked={domState === 'checked'}
                                            onChange={(e) => toggleDomain(mainCat, subCat, domName, e.target.checked || domState === 'indeterminate')}
                                          />
                                        </div>
                                        <span 
                                          className="text-xs font-bold text-gray-200 select-none flex items-center gap-1 cursor-pointer hover:text-blue-300"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            toggleExpand(domKey);
                                          }}
                                        >
                                          {expanded[domKey] ? <FiChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <FiChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                          {domName}
                                        </span>
                                      </label>
                                      
                                      <span className="text-[11px] font-semibold text-gray-400">
                                        {selectedSubCount > 0 ? (
                                          <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded">
                                            {selectedSubCount} of {totalSubCount} subtopics selected
                                          </span>
                                        ) : (
                                          <span className="text-gray-500">{totalSubCount} subtopics</span>
                                        )}
                                      </span>
                                    </div>

                                    {/* Level 4: Subtopics checkboxes */}
                                    {(expanded[domKey] || domState !== 'unchecked') && (
                                      <div className="ml-7 mt-1 border-l border-gray-700/50 pl-3 space-y-1">
                                        {subtopicsList.map(subtopic => {
                                          if (search && !subtopic.toLowerCase().includes(search.toLowerCase())) return null;

                                          const isSubChecked = (selected[mainCat]?.[subCat]?.[domName] || []).includes(subtopic);

                                          return (
                                            <label key={subtopic} className="flex items-center gap-2.5 cursor-pointer text-gray-400 hover:text-gray-200 py-0.5">
                                              <div className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border transition-colors ${isSubChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-600 bg-gray-900'}`}>
                                                {isSubChecked && <FiCheck className="text-white text-[9px]" />}
                                                <input 
                                                  type="checkbox"
                                                  className="hidden"
                                                  checked={isSubChecked}
                                                  onChange={(e) => updateSubtopicSelection(mainCat, subCat, domName, subtopic, e.target.checked)}
                                                />
                                              </div>
                                              <span className="text-xs font-medium select-none capitalize">{subtopic}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-700 bg-gray-900/50 flex items-center justify-between text-sm">
        <span className="text-gray-400">Selected Content: <span className="text-white font-bold">{totalSelected}</span></span>
        <button 
          type="button"
          onClick={clearAll}
          className="text-red-400 hover:text-red-300 font-medium transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default HierarchicalContentSelector;
