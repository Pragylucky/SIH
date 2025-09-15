const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private (Admin only)
router.get('/', protect, authorize('admin'), generalLimiter, [
  query('role')
    .optional()
    .isIn(['admin', 'operator', 'analyst', 'viewer'])
    .withMessage('Invalid role specified'),
  query('department')
    .optional()
    .isIn(['operations', 'analytics', 'emergency', 'maintenance'])
    .withMessage('Invalid department specified'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      role,
      department,
      isActive,
      limit = 20,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching users'
    });
  }
});

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private (Admin, or user accessing their own profile)
router.get('/:id', protect, generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this user profile'
      });
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching user'
    });
  }
});

// @desc    Create new user
// @route   POST /api/v1/users
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), generalLimiter, [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('role')
    .isIn(['admin', 'operator', 'analyst', 'viewer'])
    .withMessage('Invalid role specified'),
  body('department')
    .isIn(['operations', 'analytics', 'emergency', 'maintenance'])
    .withMessage('Invalid department specified')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, role, department, permissions = [] } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email or username already exists'
      });
    }

    // Set default permissions based on role
    const defaultPermissions = role === 'admin' 
      ? ['read', 'write', 'delete', 'admin'] 
      : role === 'operator' 
        ? ['read', 'write'] 
        : ['read'];

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role,
      department,
      permissions: permissions.length > 0 ? permissions : defaultPermissions
    });

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          department: user.department,
          permissions: user.permissions,
          profile: user.profile,
          preferences: user.preferences,
          isActive: user.isActive,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating user'
    });
  }
});

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private (Admin, or user updating their own profile)
router.put('/:id', protect, generalLimiter, [
  body('role')
    .optional()
    .isIn(['admin', 'operator', 'analyst', 'viewer'])
    .withMessage('Invalid role specified'),
  body('department')
    .optional()
    .isIn(['operations', 'analytics', 'emergency', 'maintenance'])
    .withMessage('Invalid department specified'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('profile.firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('profile.lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('profile.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to modify this user'
      });
    }

    // Non-admin users can only update their profile, not role/permissions
    const updateData = { ...req.body };
    if (req.user.role !== 'admin') {
      delete updateData.role;
      delete updateData.permissions;
      delete updateData.isActive;
      delete updateData.department;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating user'
    });
  }
});

// @desc    Deactivate user
// @route   PUT /api/v1/users/:id/deactivate
// @access  Private (Admin only)
router.put('/:id/deactivate', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deactivating themselves
    if (req.user.id === id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot deactivate your own account'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User deactivated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deactivating user'
    });
  }
});

// @desc    Activate user
// @route   PUT /api/v1/users/:id/activate
// @access  Private (Admin only)
router.put('/:id/activate', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User activated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while activating user'
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting user'
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/v1/users/stats/overview
// @access  Private (Admin only)
router.get('/stats/overview', protect, authorize('admin'), generalLimiter, async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          inactiveUsers: {
            $sum: { $cond: ['$isActive', 0, 1] }
          },
          byRole: {
            $push: '$role'
          },
          byDepartment: {
            $push: '$department'
          }
        }
      },
      {
        $project: {
          totalUsers: 1,
          activeUsers: 1,
          inactiveUsers: 1,
          roleDistribution: {
            admin: { $size: { $filter: { input: '$byRole', cond: { $eq: ['$$this', 'admin'] } } } },
            operator: { $size: { $filter: { input: '$byRole', cond: { $eq: ['$$this', 'operator'] } } } },
            analyst: { $size: { $filter: { input: '$byRole', cond: { $eq: ['$$this', 'analyst'] } } } },
            viewer: { $size: { $filter: { input: '$byRole', cond: { $eq: ['$$this', 'viewer'] } } } }
          },
          departmentDistribution: {
            operations: { $size: { $filter: { input: '$byDepartment', cond: { $eq: ['$$this', 'operations'] } } } },
            analytics: { $size: { $filter: { input: '$byDepartment', cond: { $eq: ['$$this', 'analytics'] } } } },
            emergency: { $size: { $filter: { input: '$byDepartment', cond: { $eq: ['$$this', 'emergency'] } } } },
            maintenance: { $size: { $filter: { input: '$byDepartment', cond: { $eq: ['$$this', 'maintenance'] } } } }
          }
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        stats: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          roleDistribution: {
            admin: 0,
            operator: 0,
            analyst: 0,
            viewer: 0
          },
          departmentDistribution: {
            operations: 0,
            analytics: 0,
            emergency: 0,
            maintenance: 0
          }
        },
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching user statistics'
    });
  }
});

module.exports = router;
