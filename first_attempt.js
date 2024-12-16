document.querySelector('button').addEventListener('click', function () {
    let text = document.getElementById('wordbox').value.toLowerCase(); 
    treemapBuild(text);
});

function treemapBuild(text) {
    let data = countChars(text);
    let width = 580, height = 400;
    let root = d3.hierarchy(data).sum(d => d.value);
    let treemapLayout = d3.treemap().size([width, height]).padding(1);

    treemapLayout(root);
    d3.select('#treemap_svg').selectAll('*').remove();  
    let svg = d3.select('#treemap_svg');
    let color = d3.scaleOrdinal(d3.schemeCategory10);

    let nodes = svg.selectAll('rect')
        .data(root.leaves())
        .enter()
        .append('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => color(d.parent.data.name))
        .attr('stroke', 'black')
        .attr('stroke-width', '1px');

    nodes.on('mouseover', function (event, d) {
        d3.select('#tooltip')
            .style('visibility', 'visible')
            .text(`Character: ${d.data.name}, Count: ${d.data.value}`);
    })
    .on('mousemove', function (event) {
        d3.select('#tooltip')
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 10) + 'px');
    })
    .on('mouseout', function () {
        d3.select('#tooltip').style('visibility', 'hidden');
    });

    nodes.on('click', function (event, d) {
        d3.select('#sankeyTitle').text(`Character flow for '${d.data.name}'`);
        sankeyDo(text, d.data.name, color, d.data.value);
    });
}

function countChars(text) {
    let data = { name: "root", children: [{ name: "Vowels", children: [] }, { name: "Consonants", children: [] }, { name: "Punctuation", children: [] }] };
    let vowels = 'aeiouy', consonants = 'bcdfghjklmnpqrstvwxz', punctuation = '.,!?:;';
    let countMap = {};

    for (let char of text) {
        if (vowels.includes(char)) countMap[char] = (countMap[char] || 0) + 1;
        else if (consonants.includes(char)) countMap[char] = (countMap[char] || 0) + 1;
        else if (punctuation.includes(char)) countMap[char] = (countMap[char] || 0) + 1;
    }

    Object.entries(countMap).forEach(([key, value]) => {
        if (vowels.includes(key)) data.children[0].children.push({ name: key, value: value });
        else if (consonants.includes(key)) data.children[1].children.push({ name: key, value: value });
        else data.children[2].children.push({ name: key, value: value });
    });
    return data;
}

function sankeyDataCreate(text, selectedChar) {
    let nodes = new Set(), links = [];
    let vowels = 'aeiouy', consonants = 'bcdfghjklmnpqrstvwxz', symbols = '.,!?:;';
    let prevCounts = {}, nextCounts = {};

    for (let i = 0; i < text.length; i++) {
        if (text[i] === selectedChar) {
            let prevChar = i > 0 ? text[i - 1] : null;
            let nextChar = i < text.length - 1 ? text[i + 1] : null;

            if (prevChar && (vowels.includes(prevChar) || consonants.includes(prevChar) || symbols.includes(prevChar))) {
                prevCounts[prevChar] = (prevCounts[prevChar] || 0) + 1;
            }

            if (nextChar && (vowels.includes(nextChar) || consonants.includes(nextChar) || symbols.includes(nextChar))) {
                nextCounts[nextChar] = (nextCounts[nextChar] || 0) + 1;
            }
        }
    }

    Object.keys(prevCounts).forEach((char, i) => {
        nodes.add({ name: `prev_${char}`, group: vowels.includes(char) ? 'vowel' : consonants.includes(char) ? 'consonant' : 'symbol', count: prevCounts[char] });
    });

    nodes.add({ name: `selected_${selectedChar}`, group: vowels.includes(selectedChar) ? 'vowel' : consonants.includes(selectedChar) ? 'consonant' : 'symbol', count: prevCounts[selectedChar] || nextCounts[selectedChar] || 0 });

    Object.keys(nextCounts).forEach((char, i) => {
        nodes.add({ name: `next_${char}`, group: vowels.includes(char) ? 'vowel' : consonants.includes(char) ? 'consonant' : 'symbol', count: nextCounts[char] });
    });

    Object.entries(prevCounts).forEach(([char, count]) => {
        links.push({
            source: `prev_${char}`,
            target: `selected_${selectedChar}`,
            value: count
        });
    });

    Object.entries(nextCounts).forEach(([char, count]) => {
        links.push({
            source: `selected_${selectedChar}`,
            target: `next_${char}`,
            value: count
        });
    });

    let nodesArray = Array.from(nodes);

    links.forEach(link => {
        link.source = nodesArray.findIndex(node => node.name === link.source);
        link.target = nodesArray.findIndex(node => node.name === link.target);
    });

    return { nodes: nodesArray, links: links };
}

function sankeyDo(text, selectedChar, color, selectedCharCount) {
    let sankeyData = sankeyDataCreate(text, selectedChar);
    let width = 500;
    let height = 370;

    let marginLeft = 50;
    let marginTop = 10;
    let marginBottom = 10;  // Added bottom margin
    let adjustedWidth = width - marginLeft;

    d3.select('#sankey_svg').selectAll('*').remove(); 

    let svg = d3.select('#sankey_svg')
        .attr("width", width + marginLeft)
        .attr("height", height + marginTop + marginBottom);  // Add margin to the total height

    let sankey = d3.sankey()
        .size([adjustedWidth, height])
        .nodeWidth(20)
        .nodePadding(15);

    let graph = sankey({
        nodes: sankeyData.nodes.map(d => Object.assign({}, d)),
        links: sankeyData.links.map(d => Object.assign({}, d))
    });

    let link = svg.append("g")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`)
        .selectAll("path")
        .data(graph.links)
        .enter()
        .append("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke-width", d => Math.max(1, d.width))
        .style("stroke", "lightgrey")
        .style("fill", "none");

    let node = svg.append("g")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`)
        .selectAll("rect")
        .data(graph.nodes)
        .enter()
        .append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => {
            if (d.group === 'vowel') return color('Vowels');
            if (d.group === 'consonant') return color('Consonants');
            if (d.group === 'symbol') return color('Punctuation');
        })
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
        .attr("rx", 5);

    node.on('mouseover', function (event, d) {
        if (d.name.startsWith('selected_')) {
            d3.select('#tooltip')
                .style('visibility', 'visible')
                .text(`Character ${d.name.replace('selected_', '')} appeared ${selectedCharCount} times`);
        } else if (d.name.startsWith('prev_')) {
            d3.select('#tooltip')
                .style('visibility', 'visible')
                .text(`Character ${d.name.replace('prev_', '')} flows to ${selectedChar} ${d.count} times`);
        } else if (d.name.startsWith('next_')) {
            d3.select('#tooltip')
                .style('visibility', 'visible')
                .text(`Character ${selectedChar} flows to ${d.name.replace('next_', '')} ${d.count} times`);
        }
    })
    .on('mousemove', function (event) {
        d3.select('#tooltip')
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 10) + 'px');
    })
    .on('mouseout', function () {
        d3.select('#tooltip').style('visibility', 'hidden');
    });

    svg.append("g")
        .attr("transform", `translate(${0}, ${marginTop})`)
        .selectAll("text")
        .data(graph.nodes)
        .enter()
        .append("text")
        .attr("x", d => d.x0 + marginLeft - 10)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.05em")
        .attr("text-anchor", "end")
        .text(d => d.name.replace(/(prev_|next_|selected_)/, ''));
}

d3.select('body').append('div')
    .attr('id', 'tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', '#fff')
    .style('border', '1px solid black')
    .style('border-radius', '5px')
    .style('padding', '5px');
