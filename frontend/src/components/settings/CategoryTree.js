import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Folder, FolderOpen } from 'lucide-react';

const CategoryTree = ({ categories = [], onAdd, onEdit, onDelete }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [editingNode, setEditingNode] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Construir árbol jerárquico desde categorías planas
  const buildTree = (items) => {
    const map = {};
    const roots = [];

    // Crear mapa de items
    items.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });

    // Construir relaciones
    items.forEach(item => {
      if (item.parent_id && map[item.parent_id]) {
        map[item.parent_id].children.push(map[item.id]);
      } else if (!item.parent_id) {
        roots.push(map[item.id]);
      }
    });

    return roots;
  };

  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleStartEdit = (node) => {
    setEditingNode(node.id);
    setEditValue(node.name);
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editingNode) {
      onEdit(editingNode, editValue.trim());
      setEditingNode(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingNode(null);
    setEditValue('');
  };

  const handleAddChild = (parentId) => {
    if (newCategoryName.trim()) {
      onAdd(newCategoryName.trim(), parentId);
      setAddingTo(null);
      setNewCategoryName('');
    }
  };

  const canAddChild = (level) => {
    return level < 3; // Max 4 niveles (0, 1, 2, 3)
  };

  const renderNode = (node, level = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isEditing = editingNode === node.id;
    const isAdding = addingTo === node.id;

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 group ${
            level === 0 ? 'font-bold' : ''
          }`}
          style={{ marginLeft: `${level * 24}px` }}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 hover:bg-slate-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-600" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Folder Icon */}
          {isExpanded && hasChildren ? (
            <FolderOpen className="w-4 h-4 text-yellow-600" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-600" />
          )}

          {/* Category Name or Edit Input */}
          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="flex-1 px-2 py-1 border-2 border-slate-900 rounded text-sm"
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-sm text-slate-900">
                {node.name}
              </span>

              {/* Action Buttons */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                {canAddChild(level) && (
                  <button
                    onClick={() => setAddingTo(node.id)}
                    className="p-1 hover:bg-green-100 rounded"
                    title="Agregar subcategoría"
                  >
                    <Plus className="w-3 h-3 text-green-600" />
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(node)}
                  className="p-1 hover:bg-blue-100 rounded"
                  title="Editar"
                >
                  <Edit2 className="w-3 h-3 text-blue-600" />
                </button>
                <button
                  onClick={() => onDelete(node.id)}
                  className="p-1 hover:bg-red-100 rounded"
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3 text-red-600" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Add Child Form */}
        {isAdding && (
          <div 
            className="flex items-center gap-2 p-2 bg-green-50 border-2 border-green-200 rounded-lg mt-1"
            style={{ marginLeft: `${(level + 1) * 24}px` }}
          >
            <Folder className="w-4 h-4 text-green-600" />
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddChild(node.id);
                if (e.key === 'Escape') {
                  setAddingTo(null);
                  setNewCategoryName('');
                }
              }}
              placeholder="Nombre de subcategoría..."
              className="flex-1 px-2 py-1 border-2 border-slate-900 rounded text-sm"
              autoFocus
            />
            <button
              onClick={() => handleAddChild(node.id)}
              className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold"
            >
              Agregar
            </button>
            <button
              onClick={() => {
                setAddingTo(null);
                setNewCategoryName('');
              }}
              className="px-2 py-1 bg-slate-300 text-slate-900 rounded text-xs font-bold"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(categories);

  return (
    <div className="space-y-2">
      {tree.length > 0 ? (
        tree.map(node => renderNode(node, 0))
      ) : (
        <div className="text-center py-8 text-slate-500">
          <Folder className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No hay categorías. Agrega una para comenzar.</p>
        </div>
      )}

      {/* Add Root Category */}
      {addingTo === 'root' ? (
        <div className="flex items-center gap-2 p-3 bg-purple-50 border-2 border-purple-200 rounded-xl">
          <Folder className="w-5 h-5 text-purple-600" />
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddChild(null);
              if (e.key === 'Escape') {
                setAddingTo(null);
                setNewCategoryName('');
              }
            }}
            placeholder="Nombre de categoría raíz..."
            className="flex-1 px-3 py-2 border-2 border-slate-900 rounded-lg text-sm font-medium"
            autoFocus
          />
          <button
            onClick={() => handleAddChild(null)}
            className="px-4 py-2 bg-purple-500 border-2 border-slate-900 rounded-lg text-white font-bold hover:bg-purple-600"
          >
            Agregar
          </button>
          <button
            onClick={() => {
              setAddingTo(null);
              setNewCategoryName('');
            }}
            className="px-4 py-2 bg-slate-300 border-2 border-slate-900 rounded-lg text-slate-900 font-bold"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTo('root')}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-2"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <Plus className="w-5 h-5" />
          Agregar Categoría Principal
        </button>
      )}
    </div>
  );
};

export default CategoryTree;
