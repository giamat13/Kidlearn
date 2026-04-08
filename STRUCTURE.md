# 📚 KidLearn - Category-Based Learning Structure

## Overview

KidLearn has been reorganized into a **category-based learning system** that makes it easy for students to find and access learning materials by topic.

## New Structure

### 🏠 Entry Point

**`categories.html`** - Main learning hub where students select their learning category after setup

### 📂 Categories

The app is now organized into 4 main categories:

#### 1. 🇮🇱 **Hebrew** (`categories/hebrew.html`)
- **משחק האותיות** (Letters Game) - Learn Hebrew alphabet
- **המקרר הבריא שלי** (Healthy Fridge) - Learn food vocabulary
- **שיעור עברית** (Hebrew Lessons) - Comprehensive Hebrew lessons
- **אוצר מילים** (Vocabulary) - Expand Hebrew vocabulary

#### 2. 🇺🇸 **English** (`categories/english.html`)
- **English Lessons** - Interactive English learning
- **Grammar Rules** - Master English grammar
- **Vocabulary** - Expand English vocabulary
- **Quiz Time** - Test your knowledge
- **Memory Game** - Practice English with memory game

#### 3. 🔢 **Math & Numbers** (`categories/math.html`)
- **צבעים ומספרים** (Colors & Numbers) - Learn colors and numbers in Hebrew
- **עובדות מעניינות** (Fun Facts) - Learn about numbers and arithmetic

#### 4. 🎮 **Educational Games** (`categories/games.html`)
- **משחק הזיכרון** (Memory Game) - Classic memory game
- **משחק האותיות** (Letters Game) - Letter-based game

## 🔄 User Flow

```
index.html (Setup Screen)
    ↓
    [Student enters name & grade]
    ↓
categories.html (Category Selection)
    ↓
    [Student selects category]
    ↓
category/*.html (e.g., hebrew.html)
    ↓
    [Student selects specific app/game]
    ↓
Individual App
```

## ✨ Features

- **Easy Navigation**: Clear category buttons with icons
- **Student Profile**: Shows student name throughout the session
- **Change Student**: Quick button to switch students
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Color-Coded**: Each category has its own color scheme for easy recognition
- **Smooth Animations**: Engaging transitions and effects

## 🛠️ How to Use

1. Open `index.html` to start
2. Enter your name and grade/class
3. Click "בואו נתחיל!" (Let's Start!)
4. Select your learning category
5. Choose an app or game to learn from
6. Use the "Change Student" button (⚙️) to switch students

## 📁 File Structure

```
Kidlearn/
├── index.html                    (Setup screen)
├── categories.html               (Category selection hub)
├── categories/
│   ├── hebrew.html              (Hebrew category)
│   ├── english.html             (English category)
│   ├── math.html                (Math & Numbers category)
│   └── games.html               (Educational Games category)
├── Learn-Color-Numburs/         (Color & Numbers app)
├── Letters-game/                (Letters game app)
├── memory-game/                 (Memory game app)
├── the magical fridge/          (Food vocabulary app)
├── learn/
│   └── apps/
│       ├── english.html
│       ├── grammar.html
│       ├── hebrew.html
│       ├── vocab.html
│       └── quiz.html
└── ... (other resources)
```

## 🎨 Category Colors

- **Hebrew** 🇮🇱 - Pink/Red (`#FF6B9D`)
- **English** 🇺🇸 - Blue (`#60A5FA`)
- **Math** 🔢 - Green (`#34D399`)
- **Games** 🎮 - Yellow/Gold (`#FEC163`)

## 🔐 Cookies & User Data

The app uses browser cookies to remember:
- `studentName` - Student's name (365 days)
- `studentGrade` - Student's grade/class (365 days)

Students can clear this by clicking the settings button (⚙️) on any page.

## 🌐 Responsive & Accessible

- RTL/LTR language support (Hebrew and English)
- Mobile-friendly design
- Touch-friendly buttons and navigation
- Accessible color contrasts

---

**Happy Learning! 🎓✨**
