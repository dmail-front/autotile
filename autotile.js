var Game = {};
Game.cellwidth = 32; // renommer tilewidth?
Game.cellheight = 32;

(function(){

/**
Retourne un tableau de quatres partie
Chaque partie est une coordonée x,y
La première partie vaut x,y puis tourne dans le sens des aiguilles d'une montre en ajoutant 1 à x et y
L'option order permet de récupérer les parties dans un ordre préétabli
*/
function getParts(x,y,order){
	var parts = [[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
	return order ? [parts[order[0]], parts[order[1]], parts[order[2]], parts[order[3]]] : parts;
}

/**
Les découpents servents à identifier les coordonées des parties qui compose l'autotile
Junction est la tuile servant à relier les autotiles entre eux
Center est utilisé lorsque l'autotile n'a pas à s'adapter (entouré de lui même)
Les coordonées sont donné par portion de 16x16, moitié de la taille normale
*/

var formats = [];

// RPG maker XP
formats.push({
	name:'xp',
	width:96,
	height:128,
	tiles:{
		junction: 		getParts(4, 0),
		center: 		getParts(2, 4),
		top_left:		getParts(0, 2),
		top:    		getParts(2, 2),
		top_right: 		getParts(4, 2),
		right:  		getParts(4, 4),
		bottom_right:	getParts(4, 6),
		bottom: 		getParts(2, 6),
		bottom_left: 	getParts(0, 6),
		left:   		getParts(0, 4)
	}
});

// RPG maker VX
formats.push({
	name:'vx',
	width:64,
	height:96,
	tiles:{
		junction: 		getParts(2, 0),
		center: 		getParts(1, 3, [2,3,0,1]),
		top_left:		getParts(0, 2),
		top:    		getParts(1, 2, [1,0,3,2]),
		top_right: 		getParts(2, 2),
		right:  		getParts(2, 3, [3,2,1,0]),
		bottom_right:	getParts(2, 4),
		bottom: 		getParts(1, 4, [1,0,3,2]),
		bottom_left: 	getParts(0, 4),
		left:   		getParts(0, 3, [3,2,1,0])
	}
});

function getFormat(img){
	var i = formats.length;
	while(i--) if( img.height == formats[i].height ) return formats[i];
	throw new Error('Impossible de trouver le format de '+img);
};

/**
Le plan part de la découpe pour établir les coordonées de 48 adaptations possible de l'autotile
Un plan est un tableau de 48 parties
Une partie définit les coordonées de quatré carré de 16x16 qui compose ce cas d'adaptation
*/

function createPlan(format){
	var
		tiles = format.tiles,
		plan = [],
		dir, parts, i, pos, j
	;
	
	/* Aucun contact
	- 0: On utilise les angles pour ce cas	
	*/
	dir = [tiles.top_left, tiles.top_right, tiles.bottom_right, tiles.bottom_left];
	parts = [];
	for(i=0;i<4;i++) parts[i] = dir[i][i];
	plan[0] = parts;
	
	/* Un contact
	- 1,2,4,8: On utilise les angles selon ou se trouve le contact
	
	NOTE: le cas right fait que aucun angle provenant de right n'est utilisé
	On varie selon 1001 | 1100 | 0110 | 0011 où 1 représente i et 0 pos d'ou la vérif pour connaitre si on utilise pos ou i
	*/	
	pos = 1;
	for(i=0;i<4;i++){
		parts = [];
		for(j=0;j<4;j++){
			parts[j] = dir[(j == i || j == i-1 || j == i+3) ? i : pos][j];
		}
		plan[Math.pow(2,i)] = parts;
		
		pos++;
		if( pos > 3 ) pos = 0;
	}
	
	/* Deux contacts
	- 3,6,9,12: Avec jonctions
	- 43 à 46: Avec jonctions
	- 5,10: cas particulier qu'on définit manuellement
	*/
	dir = [tiles.top_right, tiles.bottom_right, tiles.bottom_left, tiles.top_left];
	pos = 3;
	for(i=0;i<4;i++){
		parts = [].concat(dir[i]);
		parts[pos] = tiles.junction[pos];
		plan[3*(i+1)] = parts; // avec une jonction
		plan[43+i] = dir[i]; // sans jonction
		
		pos++;
		if( pos > 3 ) pos = 0;
	}
	plan[5] = [tiles.left[0], tiles.right[1], tiles.right[2], tiles.left[3]]; // cas top+bottom, 5
	plan[10] = [tiles.top[0], tiles.top[1], tiles.bottom[2], tiles.bottom[3]]; // cas right+left 10	
	
	/* Trois contacts
	- 7,11,13,14: Cas spéciaux ou on utilise directement dir
	- 31 à 42: On met les jonctions
	
	NOTE: dir == grid.bottom signifie que c'est le seul contact que la cellule n'a pas
	*/
	dir = [tiles.bottom, tiles.left, tiles.top, tiles.right];
	pos = 1;
	for(i=0;i<4;i++){
		for(j=0;j<4;j++){
			if( !j ){		
				plan[[14,13,11,7][i]] = dir[i];
			}
			else{
				parts = [].concat(dir[i]);
				
				// ajoute une jonction pendant 2ème et 3ème boucle
				if( j == 1 || j == 3 ) parts[i] = tiles.junction[i];
				// ajoute une deuxième jonction pendant 3ème et 4ème boucle
				if( j == 2 || j == 3 ) parts[pos] = tiles.junction[pos];
				
				// on part du cas 30, on avance 3 cas par 3 et suffit d'ajouter j pour savoir dans quel cas on se trouve
				plan[30+(3*i)+j] = parts;
			}
		}
		pos++;
		if( pos > 3 ) pos = 0;
	}
	
	/* Quatres contacts (tous)
	- 15 à 30: selon qu'on a des jonctions ou des parties du centre
	
	Cas spéciaux: 15: center partout, 30: jonction partout
	*/
	var diagonals = [0,0,0,0];
	for(i=0;i<16;i++){
		parts = [];
		for(j=0;j<4;j++){
			 // permet de simuler un tableau de possibilité où a,b,c,d change de valeur a tout les 8, b tout les 4 etc
			if( !(i % (8/Math.pow(2,j))) ) diagonals[j] = !diagonals[j];
			parts[j] = diagonals[j] ? tiles.center[j] : tiles.junction[j];
		}
		plan[15+i] = parts;
	}
	
	return plan;
}

function getPlan(format){
	return format.plan || (format.plan = createPlan(format));
};

var Autotile = this.Autotile = {};

/**
Retourne la palette des 48 possibilitées d'adaptation d'un autotile
image: une image source (element HTML ou canvas)
frame: le nombre d'animation dans cette image, par convention les animations doivents être sur l'axe X, default:1 (pas d'animation)
*/
Autotile.getPalette = function(img){
	var
		format = getFormat(img),
		plan = getPlan(format),
		i = plan.length,
		frame = img.width / format.width,
		width = img.width / frame,
		height = img.height,
		canvas = document.createElement('canvas'),
		ctx = canvas.getContext('2d'),
		parts, dx, dy, j, part, draw
	;
	
	// lorsqu'on doit dessiner le cas d'adaptation et les parties animés qui vont avec
	function drawAnimedPart(sx,sy, w,h, dx,dy){
		var i = frame;
		while(i--){
			ctx.drawImage(img, sx*w+(width*i), sy*h, w,h, dx+(Game.cellwidth*i), dy, w,h);
		}
	};
	
	// lorsque l'autotile ne s'anime pas
	function drawPart(sx,sy, w,h, dx,dy){
		// console.log('dessine le carré depuis '+sx+':'+sy+' de taille '+w+'x'+h+' en '+dx*w+':'+dy*h)
		ctx.drawImage(img, sx*w,sy*h, w,h, dx,dy, w,h);
	};
	
	canvas.width = Game.cellwidth * frame; // nombre d'état à représenter
	canvas.height = Game.cellheight * i; // nombre de possibilité à représenter * 32 sur l'axe vertical donc
	draw = frame > 1 ? drawAnimedPart : drawPart;
	
	var halfwidth = Game.cellwidth/2;
	var halfheight = Game.cellheight/2;
	
	while(i--){
		parts = plan[i];
		dx = 0;
		dy = Game.cellwidth * i;
		
		for(j=0;j<4;j++){
			part = parts[j];
			if( j == 1 ) dx+= halfwidth;
			else if( j == 2 ) dy+= halfheight;
			else if( j == 3 ) dx-= halfwidth;
			
			draw(part[0],part[1], halfwidth,halfheight, dx,dy);
		}
		
		ctx.fillText(i, dx, dy);
	}
	
	return canvas;
};

/**
Retourne la position dans la palette pour la cellule aux coordonées x,y dans grid

grid se présente comme ceci:
var grid = [
	[0,1,0], // rangée 0 contentant trois cellules: 0,1,0
	[0,0,0],
	[0,1,1]
];
*/
Autotile.getPosition = function(grid,x,y){
	var
		row = grid[y],
		cell = row[x],
		width = row.length,
		height = grid.length,
		W, E, N, S, c = 0, i = 0
	;
	
	// les bords de la carte
	W = (x === 0);
	E = (x === width-1);
	N = (y === 0);
	S = (y === height-1);
	
	// si on est pas au bord on récupère la rangée au dessus
	if( !N ) up = grid[y-1];
	// et la rangée en dessous
	if( !S ) down = grid[y+1];
	
	// lorsque la cellule en contact est identique on ajout à n, selon ces valeurs
	// bottom = 1, left = 2, top = 4, right = 8
	if( S || down[x] == cell ) c++;
	if( W || row[x-1] == cell ) c+=2;
	if( N || up[x] == cell ) c+=4;
	if( E || row[x+1] == cell ) c+=8;
	
	switch(c){
		case 15:
			/*
			if( W ) c+= 3;
			else{
				if( S || down[x-1] == cell ) c++;
				if( N || up[x-1] == cell ) c+=2;
			}
			if( E ) c+= 12;
			else{
				if( S || down[x+1] == cell ) c+=4;
				if( N || up[x+1] == cell ) c+=8;
			}			
			*/
			if( W || S || down[x-1] == cell ) c++; // left,bot
			if( W || N || up[x-1] == cell ) c+=2; // left,top
			if( E || S || down[x+1] == cell ) c+=4; // right,bot
			if( E || N || up[x+1] == cell ) c+=8; // right,top
		return c;
		case 14:
			/*
			if( N ) return 33;
			if( W || up[x-1] == cell ) i++;
			if( N || up[x+1] == cell ) i+=2;
			*/
			if( W || N || up[x-1] == cell ) i++; // left,top
			if( E || N || up[x+1] == cell ) i+=2; // right,top
		return i ? 30+i : c;
		case 13:
			/*
			if( E ) return 36;
			if( S || down[x+1] == cell ) i++;
			if( N || up[x+1] == cell ) i+=2;
			*/
			if( E || S || down[x+1] == cell ) i++; // right,bot
			if( E || N || up[x+1] == cell ) i+=2; // right,top
		return i ? 33+i : c;
		case 11:
			/*
			if( S ) return 39;
			if( W || down[x-1] == cell ) i++;
			if( E || down[x+1] == cell ) i+=2;
			*/
			if( W || S || down[x-1] == cell ) i++; // left,bot
			if( E || S || down[x+1] == cell ) i+=2; // right,bot
		return i ? 36+i : c;
		case 7:
			/*
			if( W ) return 42;
			if( S || down[x-1] == cell ) i++;
			if( N || up[x-1] == cell ) i+=2;
			*/
			if( W || S || down[x-1] == cell ) i++; // left,bot
			if( W || N || up[x-1] == cell ) i+=2; // left,top
		return i ? 39+i : c;
		case 3: return W || S || down[x-1] == cell ? 43 : c; // left,bot
		case 6: return W || N || up[x-1] == cell ? 44 : c; // left,top
		case 9: return E || S || down[x+1] == cell ? 45 : c; // right,bot
		case 12: return E || N || up[x+1] == cell ? 46 : c; // right,top	
	}
	
	return c;
};

})();