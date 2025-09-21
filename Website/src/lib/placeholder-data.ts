import type { Post, UserProfile } from './types';

const users: UserProfile[] = [
  {
    id: '1',
    display_name: 'Alex',
    username: 'naturelover',
    avatar_url: 'https://picsum.photos/seed/user1/200',
    bio: 'Capturing the beauty of the great outdoors. 🌲🏔️',
  },
  {
    id: '2',
    display_name: 'Bella',
    username: 'cityscapes',
    avatar_url: 'https://picsum.photos/seed/user2/200',
    bio: 'Urban explorer and lover of tall buildings. 🌃',
  },
  {
    id: '3',
    display_name: 'Charlie',
    username: 'foodfanatic',
    avatar_url: 'https://picsum.photos/seed/user3/200',
    bio: 'Eating my way around the world, one dish at a time. 🍝🍕',
  },
  {
    id: '4',
    display_name: 'Diana',
    username: 'travelbug',
    avatar_url: 'https://picsum.photos/seed/user4/200',
    bio: 'Wanderlust-driven soul. Next stop: everywhere. ✈️🌍',
  },
   {
    id: '5',
    display_name: 'Ethan',
    username: 'techguru',
    avatar_url: 'https://picsum.photos/seed/user5/200',
    bio: 'Latest gadgets and tech news. 💻📱',
  },
];

const posts: Post[] = [
  {
    id: 1,
    text: "Exploring the serene beauty of the forest. Nature is the best artist! 🌲 #nature #forest #serenity",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    author: users[0],
    media: [{ id: 1, url: 'https://picsum.photos/seed/post1/800/1000', mime_type: 'image/jpeg', width: 800, height: 1000 }],
  },
  {
    id: 2,
    text: "The city that never sleeps. The energy is just electric! 🌃 #city #nightlife #urban",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    author: users[1],
    media: [{ id: 2, url: 'https://picsum.photos/seed/post2/1200/800', mime_type: 'image/jpeg', width: 1200, height: 800 }],
  },
  {
    id: 3,
    text: "Just cooked up a storm. This pasta was divine! 🍝 #foodie #homemade #pasta",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    author: users[2],
    media: [{ id: 3, url: 'https://picsum.photos/seed/post3/800/800', mime_type: 'image/jpeg', width: 800, height: 800 }],
  },
  {
    id: 4,
    text: "Wanderlust got me again. Off to another adventure! ✈️ #travel #explore #wanderlust",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    author: users[3],
    media: [],
  },
  {
    id: 5,
    text: "A good book and a cup of coffee. The perfect Sunday. ☕️ #reading #coffee #weekend",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    author: users[0],
    media: [{ id: 5, url: 'https://picsum.photos/seed/post5/800/1200', mime_type: 'image/jpeg', width: 800, height: 1200 }],
  },
  {
    id: 6,
    text: "Caught this incredible sunset today. Some moments are just priceless. 🌅 #sunset #beautiful #moment",
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    author: users[1],
    media: [{ id: 6, url: 'https://picsum.photos/seed/post6/1000/800', mime_type: 'image/jpeg', width: 1000, height: 800 }],
  },
  {
    id: 7,
    text: "Morning workout done! Feeling energized and ready to take on the day. 💪 #fitness #motivation #healthy",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    author: users[4],
    media: [{ id: 7, url: 'https://picsum.photos/seed/post7/900/600', mime_type: 'image/jpeg', width: 900, height: 600 }],
  },
  {
    id: 8,
    text: "Throwback to that mountain hike. The views were worth the climb! ⛰️ #tbt #hiking #mountains",
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    author: users[3],
    media: [{ id: 8, url: 'https://picsum.photos/seed/post8/800/900', mime_type: 'image/jpeg', width: 800, height: 900 }],
  }
];

const placeholderData = {
  users,
  posts,
};

export default placeholderData;
