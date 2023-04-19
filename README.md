# brytfeed (pre-release)

A zero-day, real-time YouTube feed with a feature-rich, highly customizable browser GUI.

ytzero has videos, channels, searches and topics. 

The most important concepts of understanding ytzero is that 

1) videos belong to channels
2) channels belong to searches
3) searches belong to topics

ytzero focuses on (but is not limited to) videos published within the past 24 hours.

## Quick Start Guide

Download and unzip ytzero.zip...

```
npm install
node index
```

Or (once released to NPM)

```
npm install -g ytzero
ytzero
```
When the server is running, open a browser tab, enter address 
```
http://localhost:3164
```

Click on topic  
Click on new  
Add a topic that interests you. e.g. "US Politics", "Soccer", "Anime"  
Confirm  

Now choose you topic from the list of topics.  

Click on search  
Click on new  
Add a search term.  e.g. "Trump", "Arsenal", "Naruto"  
Choose the channel update method. e.g. "search", "scan", "update", "like", "follow"   
For channel results limited to your search term, use "search"  
Confirm  

While the server is running, ytzero continues to poll this search adding new videos your database.  

Click on videos  
You are on your way.  

## Disclaimer

Still in development. No guarantees. Use at your own risk. Etc.
