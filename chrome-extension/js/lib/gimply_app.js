gimply_app = {
    getUpdatesIssueNumber: function(repoName, token){
        return $.ajax("https://gimply.herokuapp.com/items/show?key=" + repoName + "&token=" + token).pipe(function(response){
            if(response){
                response = JSON.parse(response);
            }
            return response.current_issue_number;
        }, function(xhr, status, e){
            return xhr.status;
        });
    },
    setUpdatesIssueNumber: function(repoName, issueNumber, token){
        return $.ajax({
            url: "https://gimply.herokuapp.com/items",
            type: "POST",
            data: {
                token: token,
                key: repoName,
                value: JSON.stringify({ current_issue_number: issueNumber})
            }
        });
    }
}