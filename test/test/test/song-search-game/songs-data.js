// Songs database - predefined Hebrew songs for kids
const SONGS_DATABASE = [
    {
        id: "dZFd7LHc6rA",
        title: "שירת הנושא",
        artist: "עינת צפריר",
        thumbnail: "https://img.youtube.com/vi/dZFd7LHc6rA/mqdefault.jpg"
    },
    {
        id: "ysv9L1cOQ2w",
        title: "שרנו שיר",
        artist: "בנו סוקול",
        thumbnail: "https://img.youtube.com/vi/ysv9L1cOQ2w/mqdefault.jpg"
    },
    {
        id: "nNhVU8wTtDw",
        title: "ישן על הראש",
        artist: "שלום חנוך",
        thumbnail: "https://img.youtube.com/vi/nNhVU8wTtDw/mqdefault.jpg"
    },
    {
        id: "NRVPqPnPXjU",
        title: "עני ועשיר",
        artist: "בנו סוקול",
        thumbnail: "https://img.youtube.com/vi/NRVPqPnPXjU/mqdefault.jpg"
    },
    {
        id: "h4PfPT8K8Gk",
        title: "בואו נרקוד",
        artist: "זאב הנביא",
        thumbnail: "https://img.youtube.com/vi/h4PfPT8K8Gk/mqdefault.jpg"
    },
    {
        id: "p5PYKNqHb3k",
        title: "חיתול, חיתול",
        artist: "צחי נוי",
        thumbnail: "https://img.youtube.com/vi/p5PYKNqHb3k/mqdefault.jpg"
    },
    {
        id: "GqDXNh_OjN8",
        title: "שיר על הצבעים",
        artist: "צחי נוי",
        thumbnail: "https://img.youtube.com/vi/GqDXNh_OjN8/mqdefault.jpg"
    },
    {
        id: "K7OEd4kZcFY",
        title: "שיר הגיצגוצ",
        artist: "אריק סיוני",
        thumbnail: "https://img.youtube.com/vi/K7OEd4kZcFY/mqdefault.jpg"
    },
    {
        id: "84wQ23ib0k8",
        title: "ילד שקט",
        artist: "זוהר ארגוב",
        thumbnail: "https://img.youtube.com/vi/84wQ23ib0k8/mqdefault.jpg"
    },
    {
        id: "j1TKZKnHqQ8",
        title: "רומנטיקה",
        artist: "שלום חנוך",
        thumbnail: "https://img.youtube.com/vi/j1TKZKnHqQ8/mqdefault.jpg"
    },
    {
        id: "BqnXWrI5Yqo",
        title: "שירת הלל",
        artist: "עינת צפריר",
        thumbnail: "https://img.youtube.com/vi/BqnXWrI5Yqo/mqdefault.jpg"
    },
    {
        id: "SsZsWPJEZBY",
        title: "מטפטף בדרום",
        artist: "שלום חנוך",
        thumbnail: "https://img.youtube.com/vi/SsZsWPJEZBY/mqdefault.jpg"
    },
    {
        id: "C2JzlU6XTUE",
        title: "כל הטוב",
        artist: "דוד דורון",
        thumbnail: "https://img.youtube.com/vi/C2JzlU6XTUE/mqdefault.jpg"
    },
    {
        id: "SdPJvlVbfBc",
        title: "טוביה הפיל",
        artist: "מירי מסיקה",
        thumbnail: "https://img.youtube.com/vi/SdPJvlVbfBc/mqdefault.jpg"
    },
    {
        id: "pL5a3W3DJDQ",
        title: "שיר הגרגר",
        artist: "עינת צפריר",
        thumbnail: "https://img.youtube.com/vi/pL5a3W3DJDQ/mqdefault.jpg"
    },
    {
        id: "2D6I3W-wVEo",
        title: "שקוץ",
        artist: "אריק סיוני",
        thumbnail: "https://img.youtube.com/vi/2D6I3W-wVEo/mqdefault.jpg"
    },
    {
        id: "yvGXL2exnIo",
        title: "שיר הספירה",
        artist: "עינת צפריר",
        thumbnail: "https://img.youtube.com/vi/yvGXL2exnIo/mqdefault.jpg"
    },
    {
        id: "j-2gPqn4tLI",
        title: "טוק טוק",
        artist: "בנו סוקול",
        thumbnail: "https://img.youtube.com/vi/j-2gPqn4tLI/mqdefault.jpg"
    },
    {
        id: "P7LZiGU_oEM",
        title: "גרר גרר כרכרה",
        artist: "בנו סוקול",
        thumbnail: "https://img.youtube.com/vi/P7LZiGU_oEM/mqdefault.jpg"
    },
    {
        id: "A0Iq6wFYdcE",
        title: "עוגה עוגה",
        artist: "מירי מסיקה",
        thumbnail: "https://img.youtube.com/vi/A0Iq6wFYdcE/mqdefault.jpg"
    }
];

// Search songs by query
function searchSongsLocal(query) {
    if (!query || query.trim() === '') {
        return [];
    }

    const lowerQuery = query.toLowerCase();
    return SONGS_DATABASE.filter(song =>
        song.title.toLowerCase().includes(lowerQuery) ||
        song.artist.toLowerCase().includes(lowerQuery)
    );
}
