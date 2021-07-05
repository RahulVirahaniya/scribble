const express=require('express');
const bodyParser = require('body-parser');
const app=express();
const server=require('http').createServer(app);
const io=require('socket.io')(server, {cors: {origin: "*"}});
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine','ejs');

app.get('/', (req, res) =>{
  res.render("home");
});

let EnteredName="";

app.post('/',(req,res) =>{
  EnteredName=req.body.enteredName;
  EnteredName=EnteredName.charAt(0).toUpperCase() + EnteredName.slice(1);
  res.render("sketch");
});

const users={};
const userScore = {};
const guessOnlyOnce = {};
let correctAnswer;
const totalUsers = 2;
let curActiveUser;
let wordSelectedTillNow = true;
let i=0;
let k=0;
let onlyOneUser=0;
let x;
let roundCount = {};
let curWinner;
let userRank = {};

const words=["car" , "bike" , "building" , "laptop" , "phone" , "well" , "pond" , "medicine" , "water" , "bottle" , "cap" ,
"dog" , "cat" , "puppy" , "remote"] ;




function randomNumbers(){

  let x = Math.floor((Math.random() * words.length) );
  let y = Math.floor((Math.random() * words.length) );
  while(x == y)
  {
    y = Math.floor((Math.random() * words.length) );
  }
  let z = Math.floor((Math.random() * words.length) );
  while(z==y || z==x)
  {
    z = Math.floor((Math.random() * words.length));
  }
  return [x,y,z];
}


io.on('connection', socket =>{
  users[socket.id]=EnteredName;
  userScore[socket.id]=0;
  roundCount[socket.id] = 0;
  userRank[socket.id] = 0;
  guessOnlyOnce[socket.id]=true;
  socket.broadcast.emit('user-joined', EnteredName);

  socket.emit('userId', socket.id);
  updateClients();

  if(Object.keys(users).length == totalUsers)
  {
    //looping through the users

    let windowTime = setInterval(function() {

      if(Object.keys(users).length==1) {
        onlyOneUser++;
        if(onlyOneUser==5) {
          io.to(curActiveUser).emit('gameOver', '');
          clearInterval(windowTime);
        }
      } else {
        onlyOneUser=0;
      }

      if(Object.keys(users).length==0){
        clearInterval(windowTime);
      }

      if(k%22==0) {

          wordSelectedTillNow = false;
          let arr = randomNumbers();

          correctAnswer="";
          if(i>=Object.keys(users).length || i<0) {
            i=0;
        }

        let seconds = 20;
        let TimeUpTime = 20;
        let timerData="";
        let ansHint="";

          let curUserID = Object.keys(users)[i];
          roundCount[curUserID] += 1;
          console.log(curUserID , roundCount[curUserID] );

          if(roundCount[curUserID] === 2)
          {
            seconds = -1;
            clearInterval(windowTime);
            // console.log(userScore);
            console.log("here is the current winner");
            console.log(curWinner);
            io.emit('gameFinished', {rank : userRank , winnername: users[curWinner] } );
            delete users;
            delete userScore;
            delete userRank;
          }

          i++;
          curActiveUser=curUserID;
          let assignedWords = [words[arr[0]],words[arr[1]],words[arr[2]]];

          clearInterval(x);

           x = setInterval(function() {
              if (seconds < 1) {
                clearInterval(x);
                correctAnswer="";
                timerData="Time Over!";
              } else if(seconds>TimeUpTime-10 && !wordSelectedTillNow) {
                ansHint=users[curActiveUser]+" is choosing a word!";
                timerData="Choose A Word in "+(seconds-(TimeUpTime-10))+" sec";
              } else {

                // automatically choosing a word for drawing
                if(correctAnswer=="") {
                  correctAnswer= assignedWords[Math.floor(Math.random() * 3)];
                  io.to(curActiveUser).emit('autoChosenWord', correctAnswer);
                  wordSelectedTillNow=false;
                }

                //hint
                if(seconds==5) {
                  let x = Math.floor((Math.random() * correctAnswer.length) );
                  let y = Math.floor((Math.random() * correctAnswer.length) );
                  while(x == y)
                  {
                    y = Math.floor((Math.random() * correctAnswer.length) );
                  }

                  ansHint="";

                  for(let m=0; m<correctAnswer.length; m++) {
                    if(m==x){
                      ansHint+=correctAnswer[x];
                    } else if (m==y) {
                      ansHint+=correctAnswer[y];
                    } else {
                      ansHint+="_ ";
                    }
                  }

                }  else if(seconds>5) {
                  ansHint="";
                  for(let count=0; count<correctAnswer.length; count++) {
                    ansHint+="_ ";
                  }
                }



                timerData="Time Over in "+seconds+ " sec";
              }

              io.emit('ansHint', {hint: ansHint});
              io.to(curActiveUser).emit('timer', timerData);
              seconds--;

            }, 1000);

          io.emit('restrictAccess', { id : curUserID, activeUsername: users[curUserID]});
          io.emit('passRandomWords' , assignedWords);

            for(let j=0;j<Object.keys(users).length;j++) {
                guessOnlyOnce[Object.keys(users)[j]]=true;
            }
        }

        k++;
        k=k%22;
      }, 1000);

  }
  else
  {
    console.log("waiting for users to join");
  }

  socket.on('send', data =>{

    // checking answers
    if(data.message === correctAnswer && correctAnswer!="" && curActiveUser!=data.id && guessOnlyOnce[data.id])
    {
        userScore[data.id]+=(100-5*Math.floor(k/5));
        socket.emit('youGuessedRight', {id :data.id , name: "You", message: "guessed the right answer!"});
        socket.broadcast.emit('someoneGuessedAns', {id :data.id , name: users[data.id], message: " guessed the right answer!"});
        updateClients(data.id);
        guessOnlyOnce[data.id]=false;
    }

      socket.broadcast.emit('recieve', {id :data.id , name: users[data.id], message: data.message});

  });

  socket.on('disconnect', message =>{
    if(Object.keys(users).indexOf(socket.id)<i) {
      i--;
    }
    if(socket.id==curActiveUser) {
      clearInterval(x);
      k=22;
    }
    const ID=socket.id;
    socket.broadcast.emit('left', { id :socket.id , name : users[socket.id]});
    delete users[socket.id];
    delete userScore[socket.id];
    delete userRank[socket.id];
    updateClients(ID);
  });

  socket.on('mouse', (data)=>{
    socket.broadcast.emit('mouse', data);
  });

  socket.on('mouseup',()=>{
    socket.broadcast.emit('mouseup');
  });

  socket.on('fill', (img)=>{
    socket.broadcast.emit('fill', img);
  });

  socket.on('clear', ()=>{
    socket.broadcast.emit('clear');
  });

  socket.on('removeToolbar', (id)=>{
    socket.broadcast.emit('hideToolbar' , id);
  });

  socket.on('removeWordBox', ()=>{
    socket.broadcast.emit('hideWordBox');
  });

  socket.on('curChosenWord', (data)=>{
    wordSelectedTillNow=true;
    correctAnswer = data;
    socket.broadcast.emit('guessWord', data);  //Check
  });

  function updateClients(ID) {

    // object conversion to array AND score wise sorting
    let userScoreArr = [];
    for (let id in userScore) {
        // userScoreArr[...][0] => id , userScoreArr[...][1] => score, userScoreArr[...][2] => rank
        userScoreArr.push([id, userScore[id], 0]);
    }

    userScoreArr.sort(function(a, b) {
        if(b[1]==a[1]) {
          return -1;
        }
        return b[1] - a[1];
    });

    // rank calculation
    let rank=1;
    for(let i=0;i<userScoreArr.length; i++) {
      if(i==0) {
        userScoreArr[i][2] = rank;
        userRank[userScoreArr[i][0]] = rank;
      } else {
        if(userScoreArr[i][1]==userScoreArr[i-1][1]) {
          userScoreArr[i][2] = rank;
        } else {
          rank++;
          userScoreArr[i][2] = rank;
          userRank[userScoreArr[i][0]] = rank;
        }
      }
    }

    if(userScoreArr.length > 0)
    curWinner = userScoreArr[0][0];

    const data={
      id: ID,
      users: users,
      score: userScore,
      userScoreArr: userScoreArr,
    }

    io.sockets.emit('update', data);
  }

});

const PORT = 3000 || process.env.PORT;
server.listen(PORT, () =>{console.log("Port 3000 is running");});
