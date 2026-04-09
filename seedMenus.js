const dotenv = require('dotenv');
const mongoose = require('mongoose');
const MenuGroup = require('./models/MenuGroup');
const Menu = require('./models/Menu');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/interview-system';

const menuGroupsData = [
  {
    menuGroupName: 'Dashboard',
    sequence: 1,
    isLink: true,
    menuUrl: '/admin',
    icon: 'FaTachometerAlt'
  },
  {
    menuGroupName: 'Candidates',
    sequence: 2,
    isLink: true,
    menuUrl: '/admin/candidates',
    icon: 'FaUsers'
  },
  {
    menuGroupName: 'Analytics',
    sequence: 3,
    isLink: true,
    menuUrl: '/admin/analytics',
    icon: 'FaChartBar'
  },
  {
    menuGroupName: 'Setup',
    sequence: 4,
    isLink: false,
    menuUrl: '#',
    icon: 'FaCog'
  },
  {
    menuGroupName: 'Settings',
    sequence: 5,
    isLink: true,
    menuUrl: '/admin/settings',
    icon: 'FaSlidersH'
  }
];

const setupMenusData = [
  {
    menuName: 'Role Master',
    menuUrl: '/admin/roles',
    sequence: 1,
    icon: 'FaUserTag'
  },
  {
    menuName: 'Menu Master',
    menuUrl: '/admin/menus',
    sequence: 2,
    icon: 'FaBars'
  },
  {
    menuName: 'Role Permissions',
    menuUrl: '/admin/role-permissions',
    sequence: 3,
    icon: 'FaShieldAlt'
  },
  {
    menuName: 'User Management',
    menuUrl: '/admin/users',
    sequence: 4,
    icon: 'FaUsersCog'
  }
];

async function seedMenus() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected successfully');

    // Seed MenuGroups
    console.log('\nSeeding MenuGroups...');
    const createdMenuGroups = {};

    for (const groupData of menuGroupsData) {
      const existing = await MenuGroup.findOne({ menuGroupName: groupData.menuGroupName });

      if (existing) {
        console.log(`- MenuGroup "${groupData.menuGroupName}" already exists, skipping`);
        createdMenuGroups[groupData.menuGroupName] = existing;
      } else {
        const menuGroup = new MenuGroup(groupData);
        await menuGroup.save();
        console.log(`- Created MenuGroup: "${groupData.menuGroupName}"`);
        createdMenuGroups[groupData.menuGroupName] = menuGroup;
      }
    }

    // Seed Menus under Setup MenuGroup
    console.log('\nSeeding Menus under Setup MenuGroup...');
    const setupGroup = createdMenuGroups['Setup'];

    if (!setupGroup) {
      console.error('Setup MenuGroup not found. Cannot create child menus.');
    } else {
      for (const menuData of setupMenusData) {
        const existing = await Menu.findOne({
          menuName: menuData.menuName,
          menuGroup: setupGroup._id
        });

        if (existing) {
          console.log(`- Menu "${menuData.menuName}" already exists, skipping`);
        } else {
          const menu = new Menu({
            ...menuData,
            menuGroup: setupGroup._id
          });
          await menu.save();
          console.log(`- Created Menu: "${menuData.menuName}"`);
        }
      }
    }

    console.log('\nMenu seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding menus:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

seedMenus();
